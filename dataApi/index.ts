import { db } from "@/db/drizzle";
import { salesInvoicesRawTable } from "@/db/schema";
import { avg, eq, gte, SQL, sql, sum } from "drizzle-orm";

export function getTopCustomersByRate(
  materialDescription: string,
  limit: number,
  minQty = 0,
) {
  return db
    .select({
      recipientName: salesInvoicesRawTable.recipientName,
      rate: avg(salesInvoicesRawTable.basicRate).as("rate"),
      qty: sum(salesInvoicesRawTable.qty),
    })
    .from(salesInvoicesRawTable)
    .where(eq(salesInvoicesRawTable.materialDescription, materialDescription))
    .groupBy(salesInvoicesRawTable.recipientName)
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
      recipientName: salesInvoicesRawTable.recipientName,
      revenue: sum(salesInvoicesRawTable.netRealisation).as("revenue"),
    })
    .from(salesInvoicesRawTable)
    .where(eq(salesInvoicesRawTable.materialDescription, materialDescription))
    .groupBy(salesInvoicesRawTable.recipientName)
    .orderBy(sql`"revenue" DESC`)
    .limit(limit);
}

export function getTopCustomersByVolume(
  materialDescription: string,
  limit: number,
) {
  return db
    .select({
      recipientName: salesInvoicesRawTable.recipientName,
      qty: sum(salesInvoicesRawTable.qty).as("qty"),
    })
    .from(salesInvoicesRawTable)
    .where(eq(salesInvoicesRawTable.materialDescription, materialDescription))
    .groupBy(salesInvoicesRawTable.recipientName)
    .orderBy(sql`"qty" DESC`)
    .limit(limit);
}
function orderBy(arg0: SQL<unknown>) {
  throw new Error("Function not implemented.");
}
