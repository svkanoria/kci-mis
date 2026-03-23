import { db } from "@/db/drizzle";
import {
  salesInvoicesRawTable,
  salesInvoicesDerivedTable,
  methanolPricesInterpolatedView,
  routesTable,
  destinationsTable,
} from "@/db/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getAllPeriods, formatDate, parseDate } from "@/lib/utils/date";
import { startOfMonth, format, max, min } from "date-fns";
import {
  CommonFilterParams,
  getRawCommonConditions,
  getDerivedCommonConditions,
} from "./utils";

export async function getSalesByRouteFD(
  filters: Omit<CommonFilterParams, "period">,
) {
  const rawConditions = getRawCommonConditions(filters);

  const filteredRawSq = db
    .select()
    .from(salesInvoicesRawTable)
    .where(
      and(
        ...rawConditions,
        isNotNull(salesInvoicesRawTable.basicAmount),
        isNotNull(salesInvoicesRawTable.contractDate),
      ),
    )
    .as("filtered_raw");

  const isCategoryFilter = filters.product?.startsWith("C:");

  const qtyCol = isCategoryFilter
    ? salesInvoicesDerivedTable.normQty
    : filteredRawSq.qty;

  const rateCol = isCategoryFilter
    ? salesInvoicesDerivedTable.normBasicRate
    : filteredRawSq.basicRate;

  const aggregatedSalesSq = db
    .select({
      routeId: salesInvoicesDerivedTable.routeId,
      totalQty: sql<number>`sum(${qtyCol})`.mapWith(Number).as("totalQty"),
      totalAmount: sql<number>`sum(${filteredRawSq.basicAmount})`
        .mapWith(Number)
        .as("totalAmount"),
      totalDeltaAmount:
        sql<number>`sum((${rateCol} - (${methanolPricesInterpolatedView.dailyIcisKandlaPrice} * 500)) * ${qtyCol})`
          .mapWith(Number)
          .as("totalDeltaAmount"),
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
    .leftJoin(
      methanolPricesInterpolatedView,
      eq(filteredRawSq.contractDate, methanolPricesInterpolatedView.date),
    )
    .where(and(...getDerivedCommonConditions(filters), isNotNull(rateCol)))
    .groupBy(salesInvoicesDerivedTable.routeId)
    .as("aggregated_sales");

  const rows = await db
    .select({
      routeId: aggregatedSalesSq.routeId,
      distanceKm: sql<number>`${routesTable.distanceKm}`.mapWith(Number),
      plant: routesTable.plant,
      city: destinationsTable.city,
      region: destinationsTable.region,
      destinationLat: sql<
        number | null
      >`ST_Y(${destinationsTable.coordinates})`.mapWith((v) =>
        v === null ? null : Number(v),
      ),
      destinationLng: sql<
        number | null
      >`ST_X(${destinationsTable.coordinates})`.mapWith((v) =>
        v === null ? null : Number(v),
      ),
      totalQty: aggregatedSalesSq.totalQty,
      totalAmount: aggregatedSalesSq.totalAmount,
      totalDeltaAmount: aggregatedSalesSq.totalDeltaAmount,
      history: aggregatedSalesSq.history,
    })
    .from(aggregatedSalesSq)
    .leftJoin(routesTable, eq(aggregatedSalesSq.routeId, routesTable.id))
    .leftJoin(
      destinationsTable,
      eq(routesTable.destinationId, destinationsTable.id),
    );

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
  const minInvDate = filters.from
    ? max([filters.from, new Date(minDateStr)])
    : new Date(minDateStr);
  const maxInvDate = filters.to
    ? min([filters.to, new Date(maxDateStr)])
    : new Date(maxDateStr);

  return rows.map((row) => {
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

    return {
      ...row,
      history: newHistory,
      avgPrice: row.totalQty > 0 ? row.totalAmount / row.totalQty : null,
      avgDelta: row.totalQty > 0 ? row.totalDeltaAmount / row.totalQty : null,
    };
  });
}
