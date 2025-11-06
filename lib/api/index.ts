import { db } from "@/db/drizzle";
import { salesInvoicesRawTable } from "@/db/schema";
import { eq, sql, sum } from "drizzle-orm";

export function getTopCustomersByVolume(
  materialDescription: string,
  limit: number,
) {
  return db
    .select({
      recipientName: salesInvoicesRawTable.recipientName,
      totalQty: sum(salesInvoicesRawTable.qty).as("totalQty"),
    })
    .from(salesInvoicesRawTable)
    .where(eq(salesInvoicesRawTable.materialDescription, materialDescription))
    .groupBy(salesInvoicesRawTable.recipientName)
    .orderBy(sql`"totalQty" DESC`)
    .limit(limit);
}
