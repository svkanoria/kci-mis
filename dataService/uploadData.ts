import { insertSalesInvoicesFromCSV } from "./insertSalesInvoicesFromCSV";
import path from "path";
import fs from "fs";

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
    console.log("Processing file:", absolutePath);
    await insertSalesInvoicesFromCSV(absolutePath);
    console.log("File processed successfully.");
  } catch (error) {
    console.error("An error occurred while processing the file:", error);
    process.exit(1);
  }
}

main();
