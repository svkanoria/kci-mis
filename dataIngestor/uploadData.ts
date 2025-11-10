import { insertSalesInvoicesFromCSV } from "./insertSalesInvoicesFromCSV";
import path from "path";
import fs from "fs";
import logger from "./logger";

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Please provide the file path as an argument.");
    process.exit(1);
  }

  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    console.error("The specified file does not exist:", absolutePath);
    process.exit(1);
  }

  try {
    logger.info(`Processing file: ${absolutePath}`);
    await insertSalesInvoicesFromCSV(absolutePath);
    logger.info("File processed successfully.");
  } catch (error) {
    logger.error(`An error occurred while processing the file: ${error}`);
    process.exit(1);
  }
}

main();
