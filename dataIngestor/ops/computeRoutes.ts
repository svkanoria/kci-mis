import { db } from "../drizzle";
import {
  destinationsTable,
  routesTable,
  salesInvoicesRawTable,
} from "../../db/schema";
import logger from "../logger";

export async function computeRoutes() {
  logger.info("Starting route computation...");

  // 1. Get unique {plant, consigneeCity, consigneeRegion} tuples
  const rawRoutes = await db
    .selectDistinct({
      plant: salesInvoicesRawTable.plant,
      city: salesInvoicesRawTable.consigneeCity,
      region: salesInvoicesRawTable.consigneeRegion,
    })
    .from(salesInvoicesRawTable);

  logger.info(`Found ${rawRoutes.length} unique raw routes.`);
  if (rawRoutes.length === 0) return;

  // 2. Identify unique destinations
  const uniqueDestinations = new Map<
    string,
    { city: string; region: string }
  >();
  for (const route of rawRoutes) {
    const key = `${route.city}#${route.region}`;
    if (!uniqueDestinations.has(key)) {
      uniqueDestinations.set(key, { city: route.city, region: route.region });
    }
  }

  logger.info(`Identified ${uniqueDestinations.size} unique destinations.`);

  // 3. Insert unique destinations into destinationsTable
  for (const dest of uniqueDestinations.values()) {
    await db
      .insert(destinationsTable)
      .values(dest)
      .onConflictDoNothing({
        target: [destinationsTable.city, destinationsTable.region],
      });
  }

  // 4. Fetch all destinations to build a lookup map for IDs
  const allDestinations = await db
    .select({
      id: destinationsTable.id,
      city: destinationsTable.city,
      region: destinationsTable.region,
    })
    .from(destinationsTable);

  const destinationIdMap = new Map<string, number>();
  for (const d of allDestinations) {
    const key = `${d.city}#${d.region}`;
    destinationIdMap.set(key, d.id);
  }

  // 5. Insert routes into routesTable
  for (const route of rawRoutes) {
    const key = `${route.city}#${route.region}`;
    const destId = destinationIdMap.get(key);

    if (destId !== undefined) {
      await db
        .insert(routesTable)
        .values({
          plant: route.plant,
          destinationId: destId,
        })
        .onConflictDoNothing({
          target: [routesTable.plant, routesTable.destinationId],
        });
    } else {
      logger.warn(
        `Could not find destination ID for City: ${route.city}, Region: ${route.region}`,
      );
    }
  }

  logger.info("Route computation completed.");
}
