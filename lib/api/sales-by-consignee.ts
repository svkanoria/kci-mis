import { db } from "@/db/drizzle";
import {
  salesInvoicesRawTable,
  salesInvoicesDerivedTable,
  routesTable,
  destinationsTable,
} from "@/db/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import {
  CommonFilterParams,
  getRawCommonConditions,
  getDerivedCommonConditions,
} from "./utils";

export interface ConsigneeSalesPoint {
  consigneeId: number;
  consigneeName: string;
  city: string;
  region: string;
  lat: number;
  lng: number;
  totalQty: number;
}

export async function getSalesByConsignee(
  filters: Omit<CommonFilterParams, "period">
): Promise<ConsigneeSalesPoint[]> {
  const rawConditions = getRawCommonConditions(filters);

  const filteredRawSq = db
    .select()
    .from(salesInvoicesRawTable)
    .where(and(...rawConditions, isNotNull(salesInvoicesRawTable.basicAmount)))
    .as("filtered_raw");

  const isCategoryFilter = filters.product?.startsWith("C:");
  const qtyCol = isCategoryFilter
    ? salesInvoicesDerivedTable.normQty
    : filteredRawSq.qty;

  const rows = await db
    .select({
      consigneeId: filteredRawSq.consignee,
      consigneeName: filteredRawSq.consigneeName,
      city: destinationsTable.city,
      region: destinationsTable.region,
      lat: sql<number | null>`ST_Y(${destinationsTable.coordinates})`.mapWith((v) =>
        v === null ? null : Number(v)
      ),
      lng: sql<number | null>`ST_X(${destinationsTable.coordinates})`.mapWith((v) =>
        v === null ? null : Number(v)
      ),
      totalQty: sql<number>`sum(${qtyCol})`.mapWith(Number).as("totalQty"),
    })
    .from(filteredRawSq)
    .leftJoin(
      salesInvoicesDerivedTable,
      eq(filteredRawSq.id, salesInvoicesDerivedTable.rawId)
    )
    .leftJoin(
      routesTable,
      eq(salesInvoicesDerivedTable.routeId, routesTable.id)
    )
    .leftJoin(
      destinationsTable,
      eq(routesTable.destinationId, destinationsTable.id)
    )
    .where(
      and(
        ...getDerivedCommonConditions(filters),
        isNotNull(destinationsTable.coordinates)
      )
    )
    .groupBy(
      filteredRawSq.consignee,
      filteredRawSq.consigneeName,
      destinationsTable.id,
      destinationsTable.city,
      destinationsTable.region
    )
    .orderBy(sql`sum(${qtyCol}) desc`);

  return rows.filter(
    (row): row is ConsigneeSalesPoint =>
      row.lat !== null && row.lng !== null
  );
}
