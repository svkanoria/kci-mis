import { db } from "@/db/drizzle";
import { salesInvoicesRawTable, salesInvoicesDerivedTable } from "@/db/schema";
import { and, eq, gte, lte, min, sql } from "drizzle-orm";

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
