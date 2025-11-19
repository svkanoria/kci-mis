import { db } from "@/db/drizzle";
import { salesInvoicesRawTable } from "@/db/schema";
import { avg, eq, gte, sql, sum } from "drizzle-orm";

export function getTopCustomersByRate(
  materialDescription: string,
  limit: number,
  minQty = 0,
) {
  return db
    .select({
      consigneeName: salesInvoicesRawTable.consigneeName,
      rate: avg(salesInvoicesRawTable.basicRate).as("rate"),
      qty: sum(salesInvoicesRawTable.qty),
    })
    .from(salesInvoicesRawTable)
    .where(eq(salesInvoicesRawTable.materialDescription, materialDescription))
    .groupBy(salesInvoicesRawTable.consigneeName)
    .having(({ qty }) => gte(qty, minQty.toString()))
    .orderBy(sql`"rate" DESC`)
    .limit(limit);
}

export function getTopCustomersByRevenue(
  materialDescription: string,
  limit: number,
) {
  return db
    .select({
      consigneeName: salesInvoicesRawTable.consigneeName,
      revenue: sum(salesInvoicesRawTable.netRealisation).as("revenue"),
    })
    .from(salesInvoicesRawTable)
    .where(eq(salesInvoicesRawTable.materialDescription, materialDescription))
    .groupBy(salesInvoicesRawTable.consigneeName)
    .orderBy(sql`"revenue" DESC`)
    .limit(limit);
}

export function getTopCustomersByVolume(
  materialDescription: string,
  limit: number,
) {
  return db
    .select({
      consigneeName: salesInvoicesRawTable.consigneeName,
      qty: sum(salesInvoicesRawTable.qty).as("qty"),
    })
    .from(salesInvoicesRawTable)
    .where(eq(salesInvoicesRawTable.materialDescription, materialDescription))
    .groupBy(salesInvoicesRawTable.consigneeName)
    .orderBy(sql`"qty" DESC`)
    .limit(limit);
}
