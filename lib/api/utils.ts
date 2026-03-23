import { salesInvoicesRawTable, salesInvoicesDerivedTable } from "@/db/schema";
import { gte, lte, eq } from "drizzle-orm";
import { Period, formatDate, getAllPeriods } from "../utils/date";

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

export function getRawCommonConditions(
  filters: CommonFilterParams,
  options?: { dateField?: keyof typeof salesInvoicesRawTable.$inferSelect },
) {
  const conditions = [];
  if (filters.from) {
    conditions.push(
      gte(
        salesInvoicesRawTable[options?.dateField ?? "invDate"],
        formatDate(filters.from),
      ),
    );
  }
  if (filters.to) {
    conditions.push(
      lte(
        salesInvoicesRawTable[options?.dateField ?? "invDate"],
        formatDate(filters.to),
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
export function getDerivedCommonConditions(filters: CommonFilterParams) {
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
export function processTimeSeries<T, K extends string, V>(
  rows: T[],
  period: Period,
  getDate: (row: T) => Date,
  keyName: K,
  defaultValue: V,
  getValueForKey: (row: T) => string,
  getValueForSeries: (row: T) => V,
): ({
  [P in K]: string;
} & { series: { periodStart: Date; value: V }[] })[] {
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
      }) as {
        [P in K]: string;
      } & {
        series: { periodStart: Date; value: V }[];
      },
  );
}
