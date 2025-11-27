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
 * @param getPeriodStart - A function that extracts the start date of the
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
  getPeriodStart: (row: T) => Date,
  keyName: K,
  defaultValue: V,
  getValueForKey: (row: T) => string,
  getValueForSeries: (row: T) => V,
): ({ [P in K]: string } & { series: { periodStart: Date; value: V }[] })[] {
  const allPeriods = determineAllPeriods(rows, period, getPeriodStart);

  const grouped = new Map<string, Map<number, V>>();
  for (const row of rows) {
    const key = getValueForKey(row);
    let series = grouped.get(key);
    if (!series) {
      series = new Map(allPeriods.map((p) => [p.getTime(), defaultValue]));
      grouped.set(key, series);
    }
    series.set(getPeriodStart(row).getTime(), getValueForSeries(row));
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

export function getTopCustomersByRate(
  filters: FilterParams,
  limit: number,
  qtyThreshold = 0,
) {
  return db
    .select({
      consigneeName: salesInvoicesRawTable.consigneeName,
      rate: sql<number>`avg(${salesInvoicesRawTable.basicRate})`
        .mapWith(Number)
        .as("rate"),
      qty: sql<number>`sum(${salesInvoicesRawTable.qty})`
        .mapWith(Number)
        .as("qty"),
      count: sql<number>`count(*)`.mapWith(Number).as("count"),
      gradeCount:
        sql<number>`count(distinct ${salesInvoicesRawTable.materialDescription})`
          .mapWith(Number)
          .as("gradeCount"),
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
    .groupBy(salesInvoicesRawTable.consigneeName)
    .having(({ qty }) => gte(qty, qtyThreshold))
    .orderBy(sql`"rate" DESC`)
    .limit(limit);
}

export function getTopCustomersByRevenue(filters: FilterParams, limit: number) {
  return db
    .select({
      consigneeName: salesInvoicesRawTable.consigneeName,
      revenue: sql<number>`sum(${salesInvoicesRawTable.netRealisation})`
        .mapWith(Number)
        .as("revenue"),
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
    .groupBy(salesInvoicesRawTable.consigneeName)
    .orderBy(sql`"revenue" DESC`)
    .limit(limit);
}

export function getTopCustomersByVolume(filters: FilterParams, limit: number) {
  return db
    .select({
      consigneeName: salesInvoicesRawTable.consigneeName,
      qty: sql<number>`sum(${salesInvoicesRawTable.qty})`
        .mapWith(Number)
        .as("qty"),
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
    .groupBy(salesInvoicesRawTable.consigneeName)
    .orderBy(sql`"qty" DESC`)
    .limit(limit);
}

export async function getMostConsistentCustomers(
  filters: FilterParams,
  period: Period,
) {
  const rows = await db
    .select({
      consigneeName: salesInvoicesRawTable.consigneeName,
      period: sql`date_trunc(${period}, ${salesInvoicesRawTable.invDate})`
        .mapWith((v) => new Date(v as string))
        .as("period"),
      qty: sql<number>`sum(${salesInvoicesRawTable.qty})`
        .mapWith(Number)
        .as("qty"),
      rate: sql<number>`avg(${salesInvoicesRawTable.basicRate})`
        .mapWith(Number)
        .as("rate"),
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
    .groupBy(salesInvoicesRawTable.consigneeName, sql`period`)
    .orderBy(sql`period`, salesInvoicesRawTable.consigneeName);

  return processTimeSeries(
    rows,
    period,
    (r) => r.period,
    "consigneeName",
    { qty: 0, rate: 0 },
    (r) => r.consigneeName,
    (r) => ({ qty: r.qty, rate: r.rate }),
  );
}
