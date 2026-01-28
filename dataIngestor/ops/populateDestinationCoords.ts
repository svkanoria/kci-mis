import { db } from "../drizzle";
import { destinationsTable } from "../../db/schema";
import { eq, isNull } from "drizzle-orm";
import logger from "../logger";

// Nominatim usage policy requires a valid User-Agent
const USER_AGENT = "KCI-MIS-DataIngestor/1.0";
const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function populateDestinationCoords() {
  logger.info("Starting destination coordinates population...");

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
          `Failed to fetch for ${dest.city}, ${dest.region}: ${response.statusText}`,
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
