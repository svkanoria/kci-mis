import { db } from "@/db/drizzle";
import { salesInvoicesRawTable, salesInvoicesDerivedTable } from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getAllPeriods, Period } from "@/lib/utils/date";

export interface FilterParams {
  from?: Date;
  to?: Date;
  product?: string;
}

function getRawCommonConditions(filters: FilterParams) {
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

function getDerivedCommonConditions(filters: FilterParams) {
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

export async function getTopCustomers(filters: FilterParams, period: Period) {
  const isCategoryFilter = filters.product?.startsWith("C:");
  const qtyCol = isCategoryFilter
    ? salesInvoicesDerivedTable.normQty
    : salesInvoicesRawTable.qty;

  const rows = await db
    .select({
      consigneeName: salesInvoicesRawTable.consigneeName,
      plant: salesInvoicesRawTable.plant,
      period: sql`date_trunc(${period}, ${salesInvoicesRawTable.invDate})`
        .mapWith((v) => new Date(v as string))
        .as("period"),
      qty: sql<number>`sum(${qtyCol})`.mapWith(Number).as("qty"),
      amount: sql<number>`sum(${salesInvoicesRawTable.basicAmount})`
        .mapWith(Number)
        .as("amount"),
    })
    .from(salesInvoicesRawTable)
    .leftJoin(
      salesInvoicesDerivedTable,
      eq(salesInvoicesRawTable.id, salesInvoicesDerivedTable.rawId),
    )
    .where(
      and(
        ...getRawCommonConditions(filters),
        ...getDerivedCommonConditions(filters),
      ),
    )
    .groupBy(
      salesInvoicesRawTable.consigneeName,
      salesInvoicesRawTable.plant,
      sql`period`,
    )
    .orderBy(
      sql`period`,
      salesInvoicesRawTable.consigneeName,
      salesInvoicesRawTable.plant,
    );

  const data = processTimeSeries(
    rows,
    period,
    (r) => r.period,
    "key",
    { qty: 0, amount: 0, rate: 0 },
    (r) => JSON.stringify({ c: r.consigneeName, p: r.plant }),
    (r) => ({
      qty: r.qty,
      amount: r.amount,
      rate: r.qty > 0 ? r.amount / r.qty : 0,
    }),
  );

  const result = data.map((item) => {
    const quantities = item.series.map((s) => s.value.qty);
    const amounts = item.series.map((s) => s.value.amount);
    const rates = item.series.map((s) => s.value.rate);
    const n = item.series.length;

    const totalQty = quantities.reduce((sum, q) => sum + q, 0);
    const avgQty = n > 0 ? totalQty / n : 0;
    const qtyVariance =
      n > 0
        ? quantities.reduce((sum, q) => sum + Math.pow(q - avgQty, 2), 0) / n
        : 0;
    const stdDevQty = Math.sqrt(qtyVariance);
    const cvQty = avgQty > 0 ? stdDevQty / avgQty : 0;

    const totalAmount = amounts.reduce((sum, a) => sum + a, 0);
    const avgRate = totalQty > 0 ? totalAmount / totalQty : 0;
    const rateVariance =
      n > 0
        ? rates
            .filter((r) => r > 0)
            .reduce((sum, r) => sum + Math.pow(r - avgRate, 2), 0) / n
        : 0;
    const stdDevRate = Math.sqrt(rateVariance);
    const cvRate = avgRate > 0 ? stdDevRate / avgRate : 0;

    const { c, p } = JSON.parse(item.key);

    return {
      ...item,
      consigneeName: c,
      plant: parseInt(p),
      // Qty related fields
      totalQty,
      avgQty,
      stdDevQty,
      cvQty,
      // Rate related fields
      avgRate,
      rateVariance,
      stdDevRate,
      cvRate,
      // Other
      totalAmount,
    };
  });

  return result.sort((a, b) => a.totalQty - b.totalQty).reverse();
}
