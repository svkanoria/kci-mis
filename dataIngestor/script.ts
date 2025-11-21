import path from "path";
import fs from "fs";
import logger from "./logger";
import { computeDerivedData } from "./ops/computeDerivedData";
import { insertSalesInvoicesFromCSV } from "./ops/insertSalesInvoicesFromCSV";

async function main() {
  const dirPath = process.argv[2];

  if (!dirPath) {
    console.error("Please provide the directory path as an argument.");
    process.exit(1);
  }

  const absolutePath = path.resolve(dirPath);

  if (!fs.existsSync(absolutePath)) {
    console.error("The specified path does not exist:", absolutePath);
    process.exit(1);
  }

  if (!fs.statSync(absolutePath).isDirectory()) {
    console.error("The specified path is not a directory:", absolutePath);
    process.exit(1);
  }

  const files = fs
    .readdirSync(absolutePath)
    .filter((file) => path.extname(file).toLowerCase() === ".csv");

  if (files.length === 0) {
    console.log("No CSV files found in the specified directory.");
    return;
  }

  logger.info(`Processing ${files.length} CSV files for data uploading`);

  for (const file of files) {
    const filePath = path.join(absolutePath, file);
    try {
      logger.info(`Uploading data from '${file}'`);
      await insertSalesInvoicesFromCSV(filePath);
    } catch (error) {
      logger.error(`Error uploading data from '${file}': ${error}`);
      process.exit(1);
    }
  }

  logger.info("Computing derived data");

  await computeDerivedData();

  logger.info("Data ingestion complete.");
}

main();
