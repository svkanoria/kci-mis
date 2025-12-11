import { db } from "@/db/drizzle";
import {
  salesInvoicesRawTable,
  salesInvoicesDerivedTable,
  methanolPricesInterpolatedView,
} from "@/db/schema";
import { and, eq, gte, lte, not, sql } from "drizzle-orm";
import { getAllPeriods, Period } from "@/lib/utils/date";
import {
  linearRegression,
  mean,
  standardDeviation,
  sum,
} from "simple-statistics";

/**
 * Represents common parameters used for filtering data in API requests.
 * You can extend this type to add or exclude params as per your requirements.
 *
 * @interface CommonFilterParams
 * @property {Date} [from] - The start date for the filter range.
 * @property {Date} [to] - The end date for the filter range.
 * @property {Period} [period] - The periodicity to group results by.
 * @property {string} [product] - The product identifier or name to filter by.
 */
export interface CommonFilterParams {
  from?: Date;
  to?: Date;
  period?: Period;
  product?: string;
}

function getRawCommonConditions(filters: CommonFilterParams) {
  const conditions = [];
  if (filters.from) {
    conditions.push(
      gte(
        salesInvoicesRawTable.invDate,
        filters.from.toISOString().split("T")[0],
      ),
    );
  }
  if (filters.to) {
    conditions.push(
      lte(
        salesInvoicesRawTable.invDate,
        filters.to.toISOString().split("T")[0],
      ),
    );
  }
  if (filters.product && !filters.product.startsWith("C:")) {
    conditions.push(
      eq(salesInvoicesRawTable.materialDescription, filters.product),
    );
  }
  return conditions;
}

function getDerivedCommonConditions(filters: CommonFilterParams) {
  const conditions = [];
  if (filters.product && filters.product.startsWith("C:")) {
    conditions.push(
      eq(salesInvoicesDerivedTable.productCategory, filters.product.slice(2)),
    );
  }
  return conditions;
}

function determineDateRange<T>(rows: T[], getDate: (row: T) => Date) {
  if (rows.length > 0) {
    const dates = rows.map((r) => getDate(r).getTime());
    const from = new Date(Math.min(...dates));
    const to = new Date(Math.max(...dates));
    return { from, to };
  } else {
    // No data, return null to indicate empty result
    return null;
  }
}

function determineAllPeriods<T>(
  rows: T[],
  period: Period,
  getDate: (row: T) => Date,
) {
  const dateRange = determineDateRange(rows, getDate);

  if (!dateRange) return [];

  const { from, to } = dateRange;
  return getAllPeriods(from, to, period);
}

/**
 * Processes raw data rows into a structured time-series format, grouping data
 * by a specific key and filling in missing periods with a default value.
 *
 * This function ensures that every group contains a data point for every
 * period within the range found in the input data.
 *
 * @template T - The type of the input row object.
 * @template K - The string literal type for the key name property in the
 * output.
 * @template V - The type of the value in the time series (e.g., number,
 * string).
 *
 * @param rows - An array of raw data objects to process.
 * @param period - The duration of each time bucket. Used to determine the
 * full range of periods.
 * @param getDate - A function that extracts the start date of the
 * period from a raw row.
 * @param keyName - The name of the property in the output object that will
 * hold the grouping key (e.g., 'userId', 'category').
 * @param defaultValue - The value to use for periods where no data exists in
 * the source rows.
 * @param getValueForKey - A function that extracts the unique grouping key
 * from a raw row.
 * @param getValueForSeries - A function that extracts the value for the time
 * series from a raw row.
 *
 * @returns An array of objects, where each object represents a group
 * containing the grouping key and a `series` array. The `series` array
 * contains objects with `periodStart` and `value`, sorted chronologically.
 */
function processTimeSeries<T, K extends string, V>(
  rows: T[],
  period: Period,
  getDate: (row: T) => Date,
  keyName: K,
  defaultValue: V,
  getValueForKey: (row: T) => string,
  getValueForSeries: (row: T) => V,
): ({ [P in K]: string } & { series: { periodStart: Date; value: V }[] })[] {
  const allPeriods = determineAllPeriods(rows, period, getDate);

  const grouped = new Map<string, Map<number, V>>();
  for (const row of rows) {
    const key = getValueForKey(row);
    let series = grouped.get(key);
    if (!series) {
      series = new Map(allPeriods.map((p) => [p.getTime(), defaultValue]));
      grouped.set(key, series);
    }
    series.set(getDate(row).getTime(), getValueForSeries(row));
  }

  return Array.from(grouped.entries()).map(
    ([key, series]) =>
      ({
        [keyName]: key,
        series: Array.from(series.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([time, value]) => ({
            periodStart: new Date(time),
            value,
          })),
      }) as { [P in K]: string } & {
        series: { periodStart: Date; value: V }[];
      },
  );
}

export async function getTopCustomers(
  filters: CommonFilterParams &
    Required<Pick<CommonFilterParams, "period">> & {
      grouping: string;
      channels: string;
    },
) {
  const isCategoryFilter = filters.product?.startsWith("C:");

  const groupings = filters.grouping.split(",");
  const groupRecipient = groupings.includes("recipient");
  const groupDistChannel = groupings.includes("distChannel");
  const groupPlant = groupings.includes("plant");

  const rawConditions = [
    ...getRawCommonConditions(filters),
    ...(filters.channels === "dealer-known"
      ? [
          not(
            eq(
              salesInvoicesRawTable.consigneeName,
              salesInvoicesRawTable.recipientName,
            ),
          ),
          eq(salesInvoicesRawTable.distChannelDescription, "Dealer"),
        ]
      : filters.channels === "dealer-unknown"
        ? [
            eq(
              salesInvoicesRawTable.consigneeName,
              salesInvoicesRawTable.recipientName,
            ),
            eq(salesInvoicesRawTable.distChannelDescription, "Dealer"),
          ]
        : []),
  ];

  const filteredRawSq = db
    .select()
    .from(salesInvoicesRawTable)
    .where(and(...rawConditions))
    .as("filtered_raw");

  const qtyCol = isCategoryFilter
    ? salesInvoicesDerivedTable.normQty
    : filteredRawSq.qty;

  const rows = await db
    .select({
      plant: groupPlant ? filteredRawSq.plant : sql<number>`0`,
      distChannelDescription: groupDistChannel
        ? filteredRawSq.distChannelDescription
        : sql<string>`''`,
      recipientName: groupRecipient
        ? filteredRawSq.recipientName
        : sql<string>`''`,
      consigneeName: filteredRawSq.consigneeName,
      period: sql`date_trunc(${filters.period}, ${filteredRawSq.invDate})`
        .mapWith((v) => new Date(v as string))
        .as("period"),
      qty: sql<number>`sum(${qtyCol})`.mapWith(Number).as("qty"),
      amount: sql<number>`sum(${filteredRawSq.basicAmount})`
        .mapWith(Number)
        .as("amount"),
      deltaAmount:
        sql<number>`sum((${filteredRawSq.basicRate} - (${methanolPricesInterpolatedView.dailyIcisKandlaPrice} * 500)) * ${filteredRawSq.qty})`
          .mapWith(Number)
          .as("deltaAmount"),
    })
    .from(filteredRawSq)
    .leftJoin(
      salesInvoicesDerivedTable,
      eq(filteredRawSq.id, salesInvoicesDerivedTable.rawId),
    )
    .leftJoin(
      methanolPricesInterpolatedView,
      eq(filteredRawSq.contractDate, methanolPricesInterpolatedView.date),
    )
    .where(and(...getDerivedCommonConditions(filters)))
    .groupBy(
      ...(groupPlant ? [filteredRawSq.plant] : []),
      ...(groupDistChannel ? [filteredRawSq.distChannelDescription] : []),
      ...(groupRecipient ? [filteredRawSq.recipientName] : []),
      filteredRawSq.consigneeName,
      sql`period`,
    )
    .orderBy(
      sql`period`,
      filteredRawSq.consigneeName,
      ...(groupRecipient ? [filteredRawSq.recipientName] : []),
      ...(groupDistChannel ? [filteredRawSq.distChannelDescription] : []),
      ...(groupPlant ? [filteredRawSq.plant] : []),
    );

  const data = processTimeSeries(
    rows,
    filters.period,
    (r) => r.period,
    "key",
    { qty: 0, amount: 0, rate: 0, delta: 0 },
    (r) =>
      JSON.stringify({
        p: r.plant,
        d: r.distChannelDescription,
        r: r.recipientName,
        c: r.consigneeName,
      }),
    (r) => ({
      qty: r.qty,
      amount: r.amount,
      rate: r.qty > 0 ? r.amount / r.qty : 0,
      delta: r.qty > 0 ? r.deltaAmount / r.qty : 0,
    }),
  );

  const result = data.map((item) => {
    const quantities = item.series.map((s) => s.value.qty);
    const amounts = item.series.map((s) => s.value.amount);
    const rates = item.series.map((s) => s.value.rate);
    const deltas = item.series.map((s) => s.value.delta);
    const n = item.series.length;

    // Linear Regression Calculation
    const calculateRegression = (values: number[]) => {
      if (n < 2) return { slope: 0, intercept: 0 };
      const points = values.map((y, x) => [x, y]);
      const { m, b } = linearRegression(points);
      return { slope: m, intercept: b };
    };

    const totalQty = sum(quantities);
    const avgQty = n > 0 ? mean(quantities) : 0;
    const stdDevQty = n > 0 ? standardDeviation(quantities) : 0;
    const cvQty = avgQty > 0 ? stdDevQty / avgQty : 0;
    const { slope: slopeQty, intercept: interceptQty } =
      calculateRegression(quantities);

    const totalAmount = sum(amounts);
    const avgRate = totalQty > 0 ? totalAmount / totalQty : 0;
    const rateVariance =
      n > 0
        ? rates
            .filter((r) => r > 0)
            .reduce((sum, r) => sum + Math.pow(r - avgRate, 2), 0) / n
        : 0;
    const stdDevRate = Math.sqrt(rateVariance);
    const { slope: slopeRate, intercept: interceptRate } =
      calculateRegression(rates);

    const totalDeltaAmount = item.series.reduce(
      (sum, s) => sum + s.value.delta * s.value.qty,
      0,
    );
    const avgDelta = totalQty > 0 ? totalDeltaAmount / totalQty : 0;
    const deltaVariance =
      n > 0
        ? deltas
            .filter((d) => d !== 0)
            .reduce((sum, d) => sum + Math.pow(d - avgDelta, 2), 0) / n
        : 0;
    const stdDevDelta = Math.sqrt(deltaVariance);
    const cvDelta = avgDelta !== 0 ? stdDevDelta / Math.abs(avgDelta) : 0;
    const { slope: slopeDelta, intercept: interceptDelta } =
      calculateRegression(deltas);

    const { p, d, r, c } = JSON.parse(item.key);

    return {
      ...item,
      plant: parseInt(p),
      distChannelDescription: d,
      recipientName: r,
      consigneeName: c,
      // Qty related fields
      totalQty,
      avgQty,
      stdDevQty,
      cvQty,
      slopeQty,
      interceptQty,
      // Rate related fields
      avgRate,
      rateVariance,
      stdDevRate,
      slopeRate,
      interceptRate,
      // Delta related fields
      avgDelta,
      deltaVariance,
      stdDevDelta,
      cvDelta,
      slopeDelta,
      interceptDelta,
      // Other
      totalAmount,
      totalDeltaAmount,
    };
  });

  return result.sort((a, b) => a.totalQty - b.totalQty).reverse();
}
