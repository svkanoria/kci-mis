import { db } from "@/db/drizzle";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  CommonFilterParams,
  getDerivedCommonConditions,
  getRawCommonConditions,
} from "./utils";
import { salesInvoicesDerivedTable, salesInvoicesRawTable } from "@/db/schema";

export async function getDistributionPattern(
  filters: Omit<CommonFilterParams, "from" | "to" | "period">,
) {
  const rawConditions = getRawCommonConditions(filters);

  const filteredRawSq = db
    .select()
    .from(salesInvoicesRawTable)
    .where(and(...rawConditions))
    .as("filtered_raw");

  const orderedSalesSq = db
    .select({
      id: filteredRawSq.id,
      consigneeName: filteredRawSq.consigneeName,
      distChannelDescription: filteredRawSq.distChannelDescription,
      invDate: filteredRawSq.invDate,
      prevDistChannelDescription:
        sql<string>`LAG(${filteredRawSq.distChannelDescription}) OVER (PARTITION BY ${filteredRawSq.consigneeName} ORDER BY ${filteredRawSq.invDate} ASC, ${filteredRawSq.id} ASC)`.as(
          "prevDistChannelDescription",
        ),
    })
    .from(filteredRawSq)
    .leftJoin(
      salesInvoicesDerivedTable,
      eq(filteredRawSq.id, salesInvoicesDerivedTable.rawId),
    )
    .where(and(...getDerivedCommonConditions(filters)))
    .as("ordered_sales");

  const result = await db
    .select({
      consigneeName: orderedSalesSq.consigneeName,
      distChannelDescription: orderedSalesSq.distChannelDescription,
      invDate: orderedSalesSq.invDate,
      prevDistChannelDescription: orderedSalesSq.prevDistChannelDescription,
    })
    .from(orderedSalesSq)
    .where(
      and(
        sql`${orderedSalesSq.prevDistChannelDescription} IS NOT NULL`,
        sql`${orderedSalesSq.distChannelDescription} != ${orderedSalesSq.prevDistChannelDescription}`,
      ),
    )
    .orderBy(desc(orderedSalesSq.invDate), desc(orderedSalesSq.id));

  return result;
}
