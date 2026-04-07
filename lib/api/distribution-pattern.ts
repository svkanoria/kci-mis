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
      consigneeId: filteredRawSq.consignee,
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
      consigneeId: salesInvoicesRawTable.consignee,
      lastInvDate: sql<string>`max(${salesInvoicesRawTable.invDate})`.as(
        "lastInvDate",
      ),
      invCount: count().as("invCount"),
    })
    .from(salesInvoicesRawTable)
    .groupBy(salesInvoicesRawTable.consignee)
    .as("aggregates");

  const sixMonthQtySq = db
    .select({
      consigneeId: salesInvoicesRawTable.consignee,
      avgQtyL6M: sql<number>`SUM(${salesInvoicesRawTable.qty}) / 6`
        .mapWith(Number)
        .as("avg_qty_l6m"),
    })
    .from(salesInvoicesRawTable)
    .where(
      sql`${salesInvoicesRawTable.invDate} >= (SELECT MAX(${salesInvoicesRawTable.invDate}) - INTERVAL '6 months' FROM ${salesInvoicesRawTable})`,
    )
    .groupBy(salesInvoicesRawTable.consignee)
    .as("six_months_qty");

  const rows = await db
    .select({
      consigneeId: orderedSalesSq.consigneeId,
      consigneeName: orderedSalesSq.consigneeName,
      recipientName: orderedSalesSq.recipientName,
      distChannelDescription: orderedSalesSq.distChannelDescription,
      invDate: orderedSalesSq.invDate,
      prevRecipientName: orderedSalesSq.prevRecipientName,
      prevDistChannelDescription: orderedSalesSq.prevDistChannelDescription,
      avgQtyL6M: sql<number>`COALESCE(${sixMonthQtySq.avgQtyL6M}, 0)`.mapWith(
        Number,
      ),
      lastInvDate: aggregatesSq.lastInvDate,
      invCount: aggregatesSq.invCount,
    })
    .from(orderedSalesSq)
    .leftJoin(
      aggregatesSq,
      eq(orderedSalesSq.consigneeId, aggregatesSq.consigneeId),
    )
    .leftJoin(
      sixMonthQtySq,
      eq(orderedSalesSq.consigneeId, sixMonthQtySq.consigneeId),
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
