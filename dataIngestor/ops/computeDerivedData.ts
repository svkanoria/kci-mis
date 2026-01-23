import { db } from "../drizzle";
import {
  destinationsTable,
  routesTable,
  salesInvoicesDerivedTable,
  salesInvoicesRawTable,
} from "../../db/schema";
import { eq, gt, sql } from "drizzle-orm";
import logger from "../logger";

function getRouteKey(plant: number, city: string, region: string) {
  return `${plant}####${city}####${region}`;
}

function getDerivedValues(
  rawRecord: typeof salesInvoicesRawTable.$inferSelect,
  routesMap: Map<string, number>,
) {
  let productCategory = "Other";
  let normalizationFactor = 1.0;

  const desc = rawRecord.materialDescription.toLowerCase();

  if (desc.includes("paraformaldehyde")) {
    productCategory = "Paraformaldehyde";
  } else if (desc.includes("formaldehyde")) {
    productCategory = "Formaldehyde";
    // Extract percentage if present, e.g., "Formaldehyde-43%"
    const match = desc.match(/formaldehyde.*?(\d+(\.\d+)?)%/);
    if (match) {
      const percentage = parseFloat(match[1]);
      // Normalize to 37%
      normalizationFactor = percentage / 37.0;
    }
  } else if (desc.includes("hexamine")) {
    productCategory = "Hexamine";
  } else if (desc.includes("pentaerythritol")) {
    productCategory = "Pentaerythritol";
  } else if (desc.includes("sodium formate")) {
    productCategory = "Sodium Formate";
  }

  const qty = parseFloat(rawRecord.qty);
  const basicRate = parseFloat(rawRecord.basicRate ?? "0");
  const netRealisationPerUnit = parseFloat(
    rawRecord.netRealisationPerUnit ?? "0",
  );

  const routeKey = getRouteKey(
    rawRecord.plant,
    rawRecord.consigneeCity,
    rawRecord.consigneeRegion,
  );
  const routeId = routesMap.get(routeKey);

  if (!routeId) {
    throw new Error(`Route not found for key: ${routeKey}`);
  }

  return {
    rawId: rawRecord.id,
    productCategory,
    normalizationFactor: normalizationFactor.toString(),
    normQty: (qty * normalizationFactor).toString(),
    normBasicRate: (basicRate / normalizationFactor).toString(),
    normNetRealisationPerUnit: (
      netRealisationPerUnit / normalizationFactor
    ).toString(),
    routeId,
  };
}

export async function computeDerivedData() {
  const routesData = await db
    .select({
      id: routesTable.id,
      plant: routesTable.plant,
      city: destinationsTable.city,
      region: destinationsTable.region,
    })
    .from(routesTable)
    .innerJoin(
      destinationsTable,
      eq(routesTable.destinationId, destinationsTable.id),
    );

  const routesMap = new Map<string, number>();
  for (const route of routesData) {
    routesMap.set(getRouteKey(route.plant, route.city, route.region), route.id);
  }

  const BATCH_SIZE = 100;
  let lastId = 0;
  let processedCount = 0;

  while (true) {
    const batch = await db
      .select()
      .from(salesInvoicesRawTable)
      .where(gt(salesInvoicesRawTable.id, lastId))
      .orderBy(salesInvoicesRawTable.id)
      .limit(BATCH_SIZE);

    if (batch.length === 0) {
      break;
    }

    const derivedRows = batch
      .map((record) => {
        try {
          return getDerivedValues(record, routesMap);
        } catch (e) {
          logger.error(
            `Skipping record ${record.id}: ${
              e instanceof Error ? e.message : e
            }`,
          );
          return null;
        }
      })
      .filter((r) => r !== null);

    if (derivedRows.length > 0) {
      await db
        .insert(salesInvoicesDerivedTable)
        .values(derivedRows as any)
        .onConflictDoUpdate({
          target: salesInvoicesDerivedTable.rawId,
          set: {
            normalizationFactor: sql`excluded."normalizationFactor"`,
            normBasicRate: sql`excluded."normBasicRate"`,
            normNetRealisationPerUnit: sql`excluded."normNetRealisationPerUnit"`,
            normQty: sql`excluded."normQty"`,
            productCategory: sql`excluded."productCategory"`,
            routeId: sql`excluded."routeId"`,
          },
        });
    }

    lastId = batch[batch.length - 1].id;
    processedCount += batch.length;
    logger.info(`Processed ${processedCount} records...`);
  }
}
