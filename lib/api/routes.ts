import { db } from "@/db/drizzle";
import { routesTable, destinationsTable } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function getRoutes() {
  return await db
    .select({
      id: routesTable.id,
      plant: routesTable.plant,
      city: destinationsTable.city,
      region: destinationsTable.region,
      distanceKm: sql<number>`${routesTable.distanceKm}`.mapWith(Number),
      isEstimated: routesTable.isEstimated,
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
    })
    .from(routesTable)
    .innerJoin(
      destinationsTable,
      eq(routesTable.destinationId, destinationsTable.id),
    )
    .orderBy(routesTable.plant, destinationsTable.city);
}
