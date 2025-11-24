import { db } from "@/db/drizzle";
import { salesInvoicesRawTable } from "@/db/schema";
import { and, avg, eq, gte, lte, sql, sum } from "drizzle-orm";

export interface FilterParams {
  from?: Date;
  to?: Date;
  product?: string;
}

function getCommonConditions(filters: FilterParams) {
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
  if (filters.product) {
    conditions.push(
      eq(salesInvoicesRawTable.materialDescription, filters.product),
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
      rate: avg(salesInvoicesRawTable.basicRate).as("rate"),
      qty: sum(salesInvoicesRawTable.qty),
    })
    .from(salesInvoicesRawTable)
    .where(and(...getCommonConditions(filters)))
    .groupBy(salesInvoicesRawTable.consigneeName)
    .having(({ qty }) => gte(qty, qtyThreshold.toString()))
    .orderBy(sql`"rate" DESC`)
    .limit(limit);
}

export function getTopCustomersByRevenue(filters: FilterParams, limit: number) {
  return db
    .select({
      consigneeName: salesInvoicesRawTable.consigneeName,
      revenue: sum(salesInvoicesRawTable.netRealisation).as("revenue"),
    })
    .from(salesInvoicesRawTable)
    .where(and(...getCommonConditions(filters)))
    .groupBy(salesInvoicesRawTable.consigneeName)
    .orderBy(sql`"revenue" DESC`)
    .limit(limit);
}

export function getTopCustomersByVolume(filters: FilterParams, limit: number) {
  return db
    .select({
      consigneeName: salesInvoicesRawTable.consigneeName,
      qty: sum(salesInvoicesRawTable.qty).as("qty"),
    })
    .from(salesInvoicesRawTable)
    .where(and(...getCommonConditions(filters)))
    .groupBy(salesInvoicesRawTable.consigneeName)
    .orderBy(sql`"qty" DESC`)
    .limit(limit);
}
