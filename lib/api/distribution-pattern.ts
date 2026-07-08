import { db } from "@/db/drizzle";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
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
      recipientName: filteredRawSq.recipientName,
      distChannelDescription: filteredRawSq.distChannelDescription,
      invDate: filteredRawSq.invDate,
      prevRecipientName:
        sql<string>`LAG(${filteredRawSq.recipientName}) OVER (PARTITION BY ${filteredRawSq.consigneeName} ORDER BY ${filteredRawSq.invDate} ASC, ${filteredRawSq.id} ASC)`.as(
          "prevRecipientName",
        ),
      prevDistChannelDescription:
        sql<string>`LAG(${filteredRawSq.distChannelDescription}) OVER (PARTITION BY ${filteredRawSq.consigneeName} ORDER BY ${filteredRawSq.invDate} ASC, ${filteredRawSq.id} ASC)`.as(
          "prevDistChannelDescription",
        ),
      invoicesBetween:
        sql<number>`GREATEST(0, ROW_NUMBER() OVER (PARTITION BY ${filteredRawSq.consigneeName} ORDER BY ${filteredRawSq.invDate} DESC, ${filteredRawSq.id} DESC) - 1)`
          .mapWith(Number)
          .as("invoicesBetween"),
    })
    .from(filteredRawSq)
    .leftJoin(
      salesInvoicesDerivedTable,
      eq(filteredRawSq.id, salesInvoicesDerivedTable.rawId),
    )
    .where(and(...getDerivedCommonConditions(filters)))
    .as("ordered_sales");

  const aggregatesSq = db
    .select({
      consigneeName: filteredRawSq.consigneeName,
      lastInvDate: sql<string>`max(${filteredRawSq.invDate})`.as("lastInvDate"),
      invCount: count().as("invCount"),
      plants: sql<
        string[]
      >`array_agg(DISTINCT ${filteredRawSq.plant}::text)`.as("plants"),
    })
    .from(filteredRawSq)
    .groupBy(filteredRawSq.consigneeName)
    .as("aggregates");

  const isCategoryFilter = filters.product?.startsWith("C:");

  const qtyCol = isCategoryFilter
    ? salesInvoicesDerivedTable.normQty
    : filteredRawSq.qty;

  const sixMonthQtySq = db
    .select({
      consigneeName: filteredRawSq.consigneeName,
      avgQtyL6M: sql<number>`SUM(${qtyCol}) / 6`
        .mapWith(Number)
        .as("avg_qty_l6m"),
    })
    .from(filteredRawSq)
    .leftJoin(
      salesInvoicesDerivedTable,
      eq(filteredRawSq.id, salesInvoicesDerivedTable.rawId),
    )
    .where(
      sql`${filteredRawSq.invDate} >= (SELECT MAX(${filteredRawSq.invDate}) - INTERVAL '6 months' FROM ${filteredRawSq})`,
    )
    .groupBy(filteredRawSq.consigneeName)
    .as("six_months_qty");

  const rows = await db
    .select({
      consigneeName: orderedSalesSq.consigneeName,
      recipientName: orderedSalesSq.recipientName,
      distChannelDescription: orderedSalesSq.distChannelDescription,
      invDate: orderedSalesSq.invDate,
      prevRecipientName: orderedSalesSq.prevRecipientName,
      prevDistChannelDescription: orderedSalesSq.prevDistChannelDescription,
      invoicesBetween: orderedSalesSq.invoicesBetween,
      avgQtyL6M: sql<number>`COALESCE(${sixMonthQtySq.avgQtyL6M}, 0)`.mapWith(
        Number,
      ),
      lastInvDate: aggregatesSq.lastInvDate,
      invCount: aggregatesSq.invCount,
      plants: aggregatesSq.plants,
    })
    .from(orderedSalesSq)
    .leftJoin(
      aggregatesSq,
      eq(orderedSalesSq.consigneeName, aggregatesSq.consigneeName),
    )
    .leftJoin(
      sixMonthQtySq,
      eq(orderedSalesSq.consigneeName, sixMonthQtySq.consigneeName),
    )
    .where(
      and(
        sql`${orderedSalesSq.prevDistChannelDescription} IS NOT NULL`,
        sql`${orderedSalesSq.distChannelDescription} != ${orderedSalesSq.prevDistChannelDescription}`,
      ),
    )
    .orderBy(
      asc(orderedSalesSq.consigneeName),
      desc(orderedSalesSq.invDate),
      desc(orderedSalesSq.id),
    );

  type ResultRow = (typeof rows)[number] & {
    history: Pick<
      (typeof rows)[number],
      | "recipientName"
      | "distChannelDescription"
      | "invDate"
      | "prevRecipientName"
      | "prevDistChannelDescription"
    >[];
    switchCount: number;
  };

  let result: ResultRow[] = [];
  let currConsigneeName: string | undefined;
  for (const row of rows) {
    if (row.consigneeName !== currConsigneeName) {
      currConsigneeName = row.consigneeName;
      const resultRow = { ...row, history: [], switchCount: 1 };
      result.push(resultRow);
    } else {
      const lastEntry = result[result.length - 1]!;
      lastEntry.history.push({
        recipientName: row.recipientName,
        distChannelDescription: row.distChannelDescription,
        invDate: row.invDate,
        prevRecipientName: row.prevRecipientName,
        prevDistChannelDescription: row.prevDistChannelDescription,
      });
      lastEntry.switchCount = lastEntry.switchCount + 1;
    }
  }

  return result;
}
