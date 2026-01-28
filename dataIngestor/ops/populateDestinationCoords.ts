import { db } from "../drizzle";
import { destinationsTable } from "../../db/schema";
import { eq, isNull } from "drizzle-orm";
import logger from "../logger";
import fs from "fs";
import { parse } from "csv-parse";

// Nominatim usage policy requires a valid User-Agent
const USER_AGENT = "KCI-MIS-DataIngestor/1.0";
const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function populateDestinationCoords(csvFilePath?: string) {
  logger.info("Starting destination coordinates population...");

  const manualCoords = new Map<string, { lat: number; lon: number }>();

  if (csvFilePath) {
    logger.info(`Loading manual coordinates from ${csvFilePath}...`);
    try {
      const parser = fs
        .createReadStream(csvFilePath)
        .pipe(parse({ columns: true, trim: true, skip_empty_lines: true }));

      for await (const record of parser) {
        const r = record as any;
        // Known column names: city, region, latitude, longitude
        const city = r.city;
        const region = r.region;
        const latStr = r.latitude;
        const lonStr = r.longitude;

        if (city && region && latStr && lonStr) {
          const lat = parseFloat(latStr);
          const lon = parseFloat(lonStr);
          if (!isNaN(lat) && !isNaN(lon)) {
            const key = `${city}|${region}`;
            manualCoords.set(key, { lat, lon });
          }
        }
      }
      logger.info(
        `Loaded ${manualCoords.size} manual coordinate entries from CSV.`,
      );
    } catch (error) {
      logger.error(
        `Error reading CSV file: ${error}. Proceeding without manual coordinates.`,
      );
    }
  }

  // 1. Find destinations with null coordinates
  const destinationsToUpdate = await db
    .select({
      id: destinationsTable.id,
      city: destinationsTable.city,
      region: destinationsTable.region,
    })
    .from(destinationsTable)
    .where(isNull(destinationsTable.coordinates));

  logger.info(
    `Found ${destinationsToUpdate.length} destinations with missing coordinates.`,
  );

  if (destinationsToUpdate.length === 0) {
    return;
  }

  // 2. Iterate and fetch coordinates
  let updatedCount = 0;
  let failedCount = 0;

  for (const dest of destinationsToUpdate) {
    try {
      // Check if we have manual coordinates for this destination
      const key = `${dest.city?.toLowerCase().trim()}|${dest.region?.toLowerCase().trim()}`;
      if (manualCoords.has(key)) {
        const coords = manualCoords.get(key)!;
        await db
          .update(destinationsTable)
          .set({
            coordinates: { x: coords.lon, y: coords.lat },
          })
          .where(eq(destinationsTable.id, dest.id));

        logger.info(
          `Updated coordinates for ${dest.city} (from CSV): (${coords.lat}, ${coords.lon})`,
        );
        updatedCount++;
        continue;
      }

      // Respect Nominatim's rate limit.
      // 1 request per second is a good practice, but let's try with 700ms.
      await delay(700);

      const params = new URLSearchParams({
        city: dest.city,
        state: dest.region,
        country: "India",
        format: "json",
        limit: "1",
      });

      const url = `${NOMINATIM_BASE_URL}?${params.toString()}`;
      logger.info(
        `Fetching coords for: ${dest.city}, ${dest.region} [ID: ${dest.id}]`,
      );

      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
        },
      });

      if (!response.ok) {
        logger.error(
          `Failed to fetch coords for ${dest.city}, ${dest.region}: ${response.statusText}`,
        );
        failedCount++;
        continue;
      }

      const data = (await response.json()) as any[];

      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);

        if (!isNaN(lat) && !isNaN(lon)) {
          // 3. Update the database
          await db
            .update(destinationsTable)
            .set({
              coordinates: { x: lon, y: lat },
            })
            .where(eq(destinationsTable.id, dest.id));

          logger.info(`Updated coordinates for ${dest.city}: (${lat}, ${lon})`);
          updatedCount++;
        } else {
          logger.warn(
            `Received invalid coordinates for ${dest.city}: lat=${result.lat}, lon=${result.lon}`,
          );
          failedCount++;
        }
      } else {
        logger.warn(
          `No results found for ${dest.city}, ${dest.region} in India.`,
        );
        failedCount++;
      }
    } catch (error) {
      logger.error(
        `Error processing destination ${dest.city} (ID: ${dest.id}):`,
        error as any,
      );
      failedCount++;
    }
  }

  logger.info(
    `Coordinates population completed. Updated: ${updatedCount}, Failed/Not Found: ${failedCount}`,
  );
}
