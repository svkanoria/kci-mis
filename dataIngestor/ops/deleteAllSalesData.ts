import { db } from "../drizzle";
import {
  destinationsTable,
  routesTable,
  salesInvoicesDerivedTable,
  salesInvoicesRawTable,
} from "../../db/schema";
import logger, { logStyles } from "../logger";

export async function deleteAllSalesData() {
  logger.info(logStyles.info("Deleting all sales data..."));

  // Delete in order of dependency to avoid foreign key constraint violations
  // 1. Derived data (depends on Raw and Routes)
  await db.delete(salesInvoicesDerivedTable);

  // 2. Raw data
  await db.delete(salesInvoicesRawTable);

  // 3. Routes (depends on Destinations, referred by Derived)
  await db.delete(routesTable);

  // 4. Destinations (referred by Routes)
  await db.delete(destinationsTable);

  logger.info(logStyles.success("All sales data deleted."));
}
