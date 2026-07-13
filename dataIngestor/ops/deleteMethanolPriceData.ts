import { db } from "../drizzle";
import { methanolPricesTable } from "../../db/schema";
import logger, { logStyles } from "../logger";

export async function deleteMethanolPriceData() {
  logger.info(logStyles.info("Deleting all Methanol price data..."));

  await db.delete(methanolPricesTable);

  logger.info(logStyles.success("All Methanol price data deleted."));
}
