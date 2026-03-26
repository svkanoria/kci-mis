import { db } from "@/db/drizzle";
import { salesInvoicesRawTable, salesInvoicesDerivedTable } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getAllPeriods, formatDate, parseDate } from "@/lib/utils/date";
import { startOfMonth, differenceInMonths, format } from "date-fns";
import {
  CommonFilterParams,
  getRawCommonConditions,
  getDerivedCommonConditions,
} from "./utils";

export async function getLostCustomers(
  filters: Omit<CommonFilterParams, "from" | "to" | "period">,
) {
  const rawConditions = getRawCommonConditions(filters);

  const filteredRawSq = db
    .select()
    .from(salesInvoicesRawTable)
    .where(and(...rawConditions))
    .as("filtered_raw");

  const isCategoryFilter = filters.product?.startsWith("C:");

  const qtyCol = isCategoryFilter
    ? salesInvoicesDerivedTable.normQty
    : filteredRawSq.qty;

  const rows = await db
    .select({
      consigneeName: filteredRawSq.consigneeName,
      recipientName: sql<string>`json_agg(
        DISTINCT ${filteredRawSq.recipientName}
        ORDER BY ${filteredRawSq.recipientName} ASC
      )::text`,
      lastInvDate: sql<string>`max(${filteredRawSq.invDate})`.as("lastInvDate"),
      qty: sql<number>`sum(${qtyCol})`.mapWith(Number).as("qty"),
      history: sql<{ qty: number; date: string }[]>`
        json_agg(
          json_build_object(
            'qty', ${qtyCol},
            'date', ${filteredRawSq.invDate}
          ) ORDER BY ${filteredRawSq.invDate} ASC
        )
      `.as("history"),
    })
    .from(filteredRawSq)
    .leftJoin(
      salesInvoicesDerivedTable,
      eq(filteredRawSq.id, salesInvoicesDerivedTable.rawId),
    )
    .where(and(...getDerivedCommonConditions(filters)))
    .groupBy(filteredRawSq.consigneeName)
    .orderBy(sql`"qty" DESC`);

  if (rows.length === 0) {
    return [];
  }

  const [{ minDate: minDateStr, maxDate: maxDateStr }] = await db
    .select({
      // At this point, we know there is at least one row, hence
      // we are sure minDateStr and maxDateStr won't be null
      minDate: sql<string>`min(${salesInvoicesRawTable.invDate})`,
      maxDate: sql<string>`max(${salesInvoicesRawTable.invDate})`,
    })
    .from(salesInvoicesRawTable);
  const minInvDate = new Date(minDateStr);
  const maxInvDate = new Date(maxDateStr);

  return rows.map((row) => {
    const lastInvDate = new Date(row.lastInvDate);
    const monthsSinceLastInvoice = differenceInMonths(maxInvDate, lastInvDate);

    let status = 0;
    if (monthsSinceLastInvoice >= 24) status = 24;
    else if (monthsSinceLastInvoice >= 12) status = 12;
    else if (monthsSinceLastInvoice >= 9) status = 9;
    else if (monthsSinceLastInvoice >= 6) status = 6;
    else if (monthsSinceLastInvoice >= 3) status = 3;

    if (!row.history || row.history.length === 0) {
      return { ...row, lastInvDate, status, history: [] };
    }

    const monthlyData = new Map<string, number>();
    row.history.forEach((item) => {
      const monthKey = format(parseDate(item.date), "yyyy-MM");
      monthlyData.set(monthKey, (monthlyData.get(monthKey) ?? 0) + item.qty);
    });

    const periods = getAllPeriods(
      startOfMonth(minInvDate),
      startOfMonth(maxInvDate),
      "month",
    );

    const newHistory = periods.map((date) => {
      const monthKey = format(date, "yyyy-MM");
      return {
        date: formatDate(date),
        qty: monthlyData.get(monthKey) ?? 0,
      };
    });

    const activeHistory = newHistory.filter((h) => h.qty > 0);
    const avgActiveMonthQty =
      activeHistory.reduce((sum, h) => sum + h.qty, 0) / activeHistory.length;

    return {
      ...row,
      lastInvDate,
      status,
      avgActiveMonthQty,
      history: newHistory,
    };
  });
}
