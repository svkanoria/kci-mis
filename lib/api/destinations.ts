import { db } from "@/db/drizzle";
import { destinationsTable, salesInvoicesRawTable } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export async function getDestinations() {
  return await db
    .select({
      id: destinationsTable.id,
      city: destinationsTable.city,
      region: destinationsTable.region,
      lat: sql<number | null>`ST_Y(${destinationsTable.coordinates})`.mapWith(
        (v) => (v === null ? null : Number(v)),
      ),
      lng: sql<number | null>`ST_X(${destinationsTable.coordinates})`.mapWith(
        (v) => (v === null ? null : Number(v)),
      ),
    })
    .from(destinationsTable)
    .orderBy(destinationsTable.city);
}

export async function getDestinationCustomers(city: string, region: string) {
  const result = await db
    .selectDistinct({ consigneeName: salesInvoicesRawTable.consigneeName })
    .from(salesInvoicesRawTable)
    .where(
      and(
        eq(salesInvoicesRawTable.consigneeCity, city),
        eq(salesInvoicesRawTable.consigneeRegion, region),
      ),
    )
    .orderBy(salesInvoicesRawTable.consigneeName);

  return result.map((r) => r.consigneeName).filter(Boolean);
}
