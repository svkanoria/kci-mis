import { db } from "@/db/drizzle";
import { destinationsTable } from "@/db/schema";
import { sql } from "drizzle-orm";

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
