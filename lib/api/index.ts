import { db } from "@/db/drizzle";
import {
  salesInvoicesRawTable,
  salesInvoicesDerivedTable,
  methanolPricesInterpolatedView,
} from "@/db/schema";
import { and, eq, gte, isNotNull, lte, not, sql } from "drizzle-orm";
import { getAllPeriods, Period, formatDate, parseDate } from "@/lib/utils/date";
import { mean, standardDeviation, sum } from "simple-statistics";
import { calculateRegression } from "../utils/stats";
import {
  startOfMonth,
  differenceInMonths,
  format,
  differenceInDays,
  addDays,
} from "date-fns";
import { filter, sumBy } from "lodash";

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
      gte(salesInvoicesRawTable.invDate, formatDate(filters.from)),
    );
  }
  if (filters.to) {
    conditions.push(lte(salesInvoicesRawTable.invDate, formatDate(filters.to)));
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
    .where(
      and(
        ...rawConditions,
        isNotNull(salesInvoicesRawTable.basicAmount),
        isNotNull(salesInvoicesRawTable.contractDate),
      ),
    )
    .as("filtered_raw");

  const isCategoryFilter = filters.product?.startsWith("C:");

  const qtyCol = isCategoryFilter
    ? salesInvoicesDerivedTable.normQty
    : filteredRawSq.qty;

  const rateCol = isCategoryFilter
    ? salesInvoicesDerivedTable.normBasicRate
    : filteredRawSq.basicRate;

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
        sql<number>`sum((${rateCol} - (${methanolPricesInterpolatedView.dailyIcisKandlaPrice} * 500)) * ${filteredRawSq.qty})`
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
    .where(and(...getDerivedCommonConditions(filters), isNotNull(rateCol)))
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
    { qty: 0, amount: 0, rate: null, delta: null },
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
      rate: r.qty > 0 ? r.amount / r.qty : null,
      delta: r.qty > 0 ? r.deltaAmount / r.qty : null,
    }),
  );

  const result = data.map((item) => {
    const qtys = item.series.map((s) => s.value.qty);
    const amounts = item.series.map((s) => s.value.amount);
    const rates = item.series.map((s) => s.value.rate);
    const deltas = item.series.map((s) => s.value.delta);

    // Qty related fields
    const totalQty = sum(qtys);
    const avgQty = qtys.length > 0 ? mean(qtys) : 0;
    const stdDevQty = qtys.length > 0 ? standardDeviation(qtys) : 0;
    const cvQty = avgQty > 0 ? stdDevQty / avgQty : 0;
    const { slope: slopeQty, intercept: interceptQty } =
      calculateRegression(qtys);

    const totalAmount = sum(amounts);
    // Rate related fields
    const avgRate = totalQty > 0 ? totalAmount / totalQty : null;
    const filteredRates = rates.filter((r) => r !== null);
    const stdDevRate =
      filteredRates.length > 0 ? standardDeviation(filteredRates) : 0;

    const totalDeltaAmount = item.series.reduce(
      (sum, s) => sum + (s.value.delta ?? 0) * s.value.qty,
      0,
    );
    // Delta related fields
    const avgDelta = totalQty > 0 ? totalDeltaAmount / totalQty : null;
    const filteredDeltas = deltas.filter((d) => d !== null);
    const stdDevDelta =
      filteredDeltas.length > 0 ? standardDeviation(filteredDeltas) : 0;
    const cvDelta =
      avgDelta !== null && avgDelta !== 0
        ? stdDevDelta / Math.abs(avgDelta)
        : 0;
    const { slope: slopeDelta, intercept: interceptDelta } =
      calculateRegression(filteredDeltas);

    const { p, d, r, c } = JSON.parse(item.key);

    return {
      ...item,
      plant: parseInt(p),
      distChannelDescription: d,
      recipientName: r,
      consigneeName: c,
      // Qty related fields
      slopeQty,
      interceptQty,
      totalQty,
      avgQty,
      stdDevQty,
      cvQty,
      // Rate related fields
      avgRate,
      stdDevRate,
      // Delta related fields
      avgDelta,
      slopeDelta,
      interceptDelta,
      stdDevDelta,
      cvDelta,
      // Other
      totalAmount,
      totalDeltaAmount,
    };
  });

  return result.sort((a, b) => a.totalQty - b.totalQty).reverse();
}

export async function getLostCustomers(
  filters: Omit<CommonFilterParams, "from" | "to" | "period">,
) {
  const rawConditions = getRawCommonConditions(filters);

  const filteredRawSq = db
    .select()
    .from(salesInvoicesRawTable)
    .where(and(...rawConditions))
    .as("filtered_raw");

  const isCategoryFilter = filters.product?.startsWith("C:");

  const qtyCol = isCategoryFilter
    ? salesInvoicesDerivedTable.normQty
    : filteredRawSq.qty;

  const rows = await db
    .select({
      consigneeName: filteredRawSq.consigneeName,
      lastInvDate: sql<string>`max(${filteredRawSq.invDate})`.as("lastInvDate"),
      qty: sql<number>`sum(${qtyCol})`.mapWith(Number).as("qty"),
      history: sql<{ qty: number; date: string }[]>`
        json_agg(
          json_build_object(
            'qty', ${qtyCol},
            'date', ${filteredRawSq.invDate}
          ) ORDER BY ${filteredRawSq.invDate} ASC
        )
      `.as("history"),
    })
    .from(filteredRawSq)
    .leftJoin(
      salesInvoicesDerivedTable,
      eq(filteredRawSq.id, salesInvoicesDerivedTable.rawId),
    )
    .where(and(...getDerivedCommonConditions(filters)))
    .groupBy(filteredRawSq.consigneeName)
    .orderBy(sql`"qty" DESC`);

  if (rows.length === 0) {
    return [];
  }

  const [{ minDate: minDateStr, maxDate: maxDateStr }] = await db
    .select({
      // At this point, we know there is at least one row, hence
      // we are sure minDateStr and maxDateStr won't be null
      minDate: sql<string>`min(${salesInvoicesRawTable.invDate})`,
      maxDate: sql<string>`max(${salesInvoicesRawTable.invDate})`,
    })
    .from(salesInvoicesRawTable);
  const minInvDate = new Date(minDateStr);
  const maxInvDate = new Date(maxDateStr);

  return rows.map((row) => {
    const lastInvDate = new Date(row.lastInvDate);
    const monthsSinceLastInvoice = differenceInMonths(maxInvDate, lastInvDate);

    let status = 0;
    if (monthsSinceLastInvoice >= 24) status = 24;
    else if (monthsSinceLastInvoice >= 12) status = 12;
    else if (monthsSinceLastInvoice >= 9) status = 9;
    else if (monthsSinceLastInvoice >= 6) status = 6;
    else if (monthsSinceLastInvoice >= 3) status = 3;

    if (!row.history || row.history.length === 0) {
      return { ...row, lastInvDate, status, history: [] };
    }

    const monthlyData = new Map<string, number>();
    row.history.forEach((item) => {
      const monthKey = format(parseDate(item.date), "yyyy-MM");
      monthlyData.set(monthKey, (monthlyData.get(monthKey) ?? 0) + item.qty);
    });

    const periods = getAllPeriods(
      startOfMonth(minInvDate),
      startOfMonth(maxInvDate),
      "month",
    );

    const newHistory = periods.map((date) => {
      const monthKey = format(date, "yyyy-MM");
      return {
        date: formatDate(date),
        qty: monthlyData.get(monthKey) ?? 0,
      };
    });

    const activeHistory = newHistory.filter((h) => h.qty > 0);
    const avgActiveMonthQty =
      activeHistory.reduce((sum, h) => sum + h.qty, 0) / activeHistory.length;

    return {
      ...row,
      lastInvDate,
      status,
      avgActiveMonthQty,
      history: newHistory,
    };
  });
}

export async function getCustomerBuyingPatternFD(
  filters: Omit<CommonFilterParams, "period">,
) {
  const rawConditions = getRawCommonConditions(filters);

  const filteredRawSq = db
    .select()
    .from(salesInvoicesRawTable)
    .where(and(...rawConditions, isNotNull(salesInvoicesRawTable.contractDate)))
    .as("filtered_raw");

  const isCategoryFilter = filters.product?.startsWith("C:");

  const qtyCol = isCategoryFilter
    ? salesInvoicesDerivedTable.normQty
    : filteredRawSq.qty;

  const rows = await db
    .select({
      consigneeName: filteredRawSq.consigneeName,
      contractDate: filteredRawSq.contractDate,
      invDate: filteredRawSq.invDate,
      qty: sql<number>`sum(${qtyCol})`.mapWith(Number).as("qty"),
    })
    .from(filteredRawSq)
    .leftJoin(
      salesInvoicesDerivedTable,
      eq(filteredRawSq.id, salesInvoicesDerivedTable.rawId),
    )
    .where(and(...getDerivedCommonConditions(filters)))
    .groupBy(
      filteredRawSq.consigneeName,
      filteredRawSq.contractDate,
      filteredRawSq.invDate,
    )
    .orderBy(
      filteredRawSq.consigneeName,
      filteredRawSq.contractDate,
      filteredRawSq.invDate,
    );

  if (rows.length === 0) {
    return [];
  }

  const [{ minDate: minDateStr, maxDate: maxDateStr }] = await db
    .select({
      // At this point, we know there is at least one row, hence
      // we are sure minDateStr and maxDateStr won't be null
      minDate: sql<string>`min(${salesInvoicesRawTable.contractDate})`,
      maxDate: sql<string>`max(${salesInvoicesRawTable.invDate})`,
    })
    .from(salesInvoicesRawTable);
  const minInvDate = new Date(minDateStr);
  const maxInvDate = new Date(maxDateStr);

  const methanolPrices = await db
    .select({
      date: methanolPricesInterpolatedView.date,
      price: sql<number>`${methanolPricesInterpolatedView.dailyIcisKandlaPrice}`
        .mapWith(Number)
        .as("price"),
    })
    .from(methanolPricesInterpolatedView)
    .where(
      and(
        gte(methanolPricesInterpolatedView.date, formatDate(minInvDate)),
        lte(methanolPricesInterpolatedView.date, formatDate(maxInvDate)),
      ),
    )
    .orderBy(methanolPricesInterpolatedView.date);

  const methanolPriceMap = new Map<string, number>();
  methanolPrices.forEach((p) => {
    methanolPriceMap.set(p.date, Number(p.price));
  });

  let data: {
    consigneeName: string;
    contractDate: string;
    contractQty: number;
    contractMethanolPrice: number;
    gain: number;
    firstLiftingDate: string;
    finalLiftingDate: string;
    invoices: {
      date: string;
      qty: number;
      methanolPrice: number;
    }[];
  }[] = [];

  let currContract: (typeof data)[number] | null = null;

  for (const row of rows) {
    if (
      !currContract ||
      currContract.consigneeName !== row.consigneeName ||
      currContract.contractDate !== row.contractDate
    ) {
      currContract = {
        consigneeName: row.consigneeName,
        contractDate: row.contractDate!,
        contractQty: 0,
        contractMethanolPrice: methanolPriceMap.get(row.contractDate!)!,
        gain: 0,
        firstLiftingDate: row.invDate!,
        finalLiftingDate: row.invDate!,
        invoices: [],
      };
      data.push(currContract);
    }

    const currentMethanolPrice = methanolPriceMap.get(row.invDate!)!;

    currContract.invoices.push({
      date: row.invDate!,
      qty: row.qty,
      methanolPrice: currentMethanolPrice,
    });
    currContract.contractQty += row.qty;
    currContract.gain +=
      ((row.qty * (currentMethanolPrice - currContract.contractMethanolPrice)) /
        2) *
      1000;
    currContract.finalLiftingDate = row.invDate!;
  }

  return data;
}
