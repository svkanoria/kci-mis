import { methanolPricesTable } from "../../db/schema";
import { parse } from "csv-parse";
import fs from "fs";
import { mapKeys, trim } from "lodash";
import { db } from "../drizzle";
import {
  nullifyEmpty,
  transformDateFormat,
  transformNumberStr,
} from "../utils/transformers";
import logger, { logStyles } from "../logger";
import { DrizzleQueryError } from "drizzle-orm";
import chalk from "chalk";

// Keep keys sorted alphabetically for ease
const columnMapping: Record<
  Exclude<keyof typeof methanolPricesTable.$inferSelect, "id">,
  string
> = {
  date: "Date",
  dailyIcisKandlaPrice: "Price",
};

// Keep keys sorted alphabetically for ease
const columnTransformations: Partial<
  Record<keyof typeof columnMapping, any[]>
> = {
  date: [transformDateFormat],
  dailyIcisKandlaPrice: [transformNumberStr],
};

function applyTransformations(value: any, transformers: any[] | undefined) {
  const allTransformers = [nullifyEmpty, trim, ...(transformers ?? [])];
  return allTransformers.reduce(
    (acc, transformer) => (acc == null ? acc : transformer(acc)),
    value,
  );
}

function mapAndTransformCSVRecord(record: any) {
  const mappedRecord: any = {};
  for (const [schemaColumn, csvColumn] of Object.entries(columnMapping)) {
    try {
      mappedRecord[schemaColumn] = applyTransformations(
        record[csvColumn],
        columnTransformations[schemaColumn as keyof typeof columnMapping],
      );
    } catch (error) {
      throw new Error(`Could not transform column '${csvColumn}': ${error}`);
    }
  }
  return mappedRecord;
}

function stringifyUploadError(error: any) {
  let str = "";
  if (error instanceof DrizzleQueryError) {
    if (error.cause) {
      str += `${error.cause}; `;
    }
    str += `${error.message}`;
  } else {
    str = `${error}`;
  }
  return str;
}

export async function insertICISMethanolPricesFromCSV(filePath: string) {
  const records: any[] = [];

  // Read and parse the CSV file
  const parser = fs.createReadStream(filePath).pipe(parse({ columns: true }));
  for await (const record of parser) {
    records.push(mapKeys(record, (v, k) => k.trim()));
  }

  // Insert records into the database
  let i = 0;
  let uploadedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  for (const csvRecord of records) {
    logger.verbose(`Uploading record #${++i}`);
    let record;
    try {
      record = mapAndTransformCSVRecord(csvRecord);
    } catch (error) {
      logger.error(
        logStyles.error(`Upload failed for record #${i}. Reason: ${error}`),
      );
      failedCount++;
      continue;
    }

    if (!record.date || !record.dailyIcisKandlaPrice) {
      logger.warn(
        logStyles.warn(
          `Upload skipped for record #${i}. Reason: Missing date or dailyIcisKandlaPrice`,
        ),
      );
      skippedCount++;
      continue;
    }

    try {
      await db.insert(methanolPricesTable).values(record).onConflictDoUpdate({
        target: methanolPricesTable.date,
        set: record,
      });
      uploadedCount++;
    } catch (error) {
      logger.error(
        logStyles.error(
          `Upload failed for record #${i}. Reason: ${stringifyUploadError(error)}`,
        ),
      );
      failedCount++;
    }
  }

  logger.info(chalk.cyan("Summary"));
  logger.info(chalk.cyan("======="));
  logger.info(`Uploaded : ${uploadedCount}`);
  logger.info(`Skipped  : ${skippedCount}`);
  logger.info(`Failed   : ${failedCount}`);
  logger.info(chalk.bold(`TOTAL    : ${i}`));
}
