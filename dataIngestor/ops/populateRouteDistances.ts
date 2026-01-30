import { db } from "../drizzle";
import { routesTable, destinationsTable } from "../../db/schema";
import { eq, isNull } from "drizzle-orm";
import logger from "../logger";
import { plantCoords } from "../../lib/constants";
import fs from "fs";
import { parse } from "csv-parse";

// Sensible multiplier to estimate road distance from 'as the crow flies'
const ROAD_DISTANCE_MULTIPLIER = 1.3;

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

// Haversine formula to calculate distance in km
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function populateRouteDistances(csvFilePath?: string) {
  logger.info("Starting route distances population...");

  const manualDistances = new Map<
    string,
    { distance: number; isEstimated: boolean }
  >();

  if (csvFilePath) {
    logger.info(`Loading manual distances from ${csvFilePath}...`);
    try {
      const parser = fs
        .createReadStream(csvFilePath)
        .pipe(parse({ columns: true, skip_empty_lines: true }));

      for await (const record of parser) {
        const r = record as any;
        // Expected columns: plant, city, region, distance, isEstimated
        const plant = r.plant;
        const city = r.city;
        const region = r.region;
        const distStr = r.distanceKm;
        const isEstimated = r.isEstimated === "1";

        if (plant && city && region && distStr) {
          const distanceKm = parseFloat(distStr);
          if (!isNaN(distanceKm)) {
            const key = `${plant}|${city}|${region}`;
            manualDistances.set(key, { distance: distanceKm, isEstimated });
          }
        }
      }
      logger.info(
        `Loaded ${manualDistances.size} manual distance entries from CSV.`,
      );
    } catch (error) {
      logger.error(
        `Error reading CSV file: ${error}. Proceeding without manual distances.`,
      );
    }
  }

  // Select routes with missing distanceKm
  const routesToUpdate = await db
    .select({
      id: routesTable.id,
      plant: routesTable.plant,
      destCity: destinationsTable.city,
      destRegion: destinationsTable.region,
      destCoords: destinationsTable.coordinates,
    })
    .from(routesTable)
    .leftJoin(
      destinationsTable,
      eq(routesTable.destinationId, destinationsTable.id),
    )
    .where(isNull(routesTable.distanceKm));

  logger.info(`Found ${routesToUpdate.length} routes with missing distance.`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const route of routesToUpdate) {
    // Check if we have a manual distance
    if (route.destCity && route.destRegion) {
      const key = `${route.plant}|${route.destCity}|${route.destRegion}`;
      if (manualDistances.has(key)) {
        const { distance, isEstimated } = manualDistances.get(key)!;
        await db
          .update(routesTable)
          .set({
            distanceKm: String(distance),
            isEstimated: isEstimated,
          })
          .where(eq(routesTable.id, route.id));
        updatedCount++;
        continue;
      }
    }

    const plantLocation = plantCoords[route.plant as keyof typeof plantCoords];

    if (!plantLocation) {
      logger.warn(`Unknown plant ID: ${route.plant} for route ${route.id}`);
      skippedCount++;
      continue;
    }

    if (!route.destCoords) {
      skippedCount++;
      continue;
    }

    // Note that Drizzle geometry mode: 'xy' returns { x: number, y: number }
    const { x: destLon, y: destLat } = route.destCoords;

    if (destLat == null || destLon == null) {
      skippedCount++;
      continue;
    }

    const crowFliesDistance = calculateDistance(
      plantLocation.latitude,
      plantLocation.longitude,
      destLat,
      destLon,
    );

    const estimatedRoadDistance = Math.round(
      crowFliesDistance * ROAD_DISTANCE_MULTIPLIER,
    );

    await db
      .update(routesTable)
      .set({
        distanceKm: String(estimatedRoadDistance),
        isEstimated: true,
      })
      .where(eq(routesTable.id, route.id));

    updatedCount++;
  }

  logger.info(
    `Route distances population completed. Updated: ${updatedCount}, Skipped: ${skippedCount}`,
  );
}
