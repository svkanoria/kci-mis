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

function processTimeSeries<T>(
  rows: T[],
  period: Period,
  getDate: (row: T) => Date,
  getKey: (row: T) => string,
  getValue: (row: T) => number,
) {
  const allPeriods = determineAllPeriods(rows, period, getDate);

  const grouped = new Map<string, Map<number, number>>();
  for (const row of rows) {
    const key = getKey(row);
    let entry = grouped.get(key);
    if (!entry) {
      entry = new Map(allPeriods.map((p) => [p.getTime(), 0]));
      grouped.set(key, entry);
    }
    entry.set(getDate(row).getTime(), getValue(row));
  }

  return Array.from(grouped.entries()).map(([key, timeSeries]) => ({
    key,
    series: Array.from(timeSeries.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([time, value]) => ({
        period: new Date(time),
        value,
      })),
  }));
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

export async function getQtyByConsigneeAndPeriod(
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
    (r) => r.consigneeName,
    (r) => r.qty,
  );
}
