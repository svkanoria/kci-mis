import { salesInvoicesRawTable } from "../db/schema";
import { parse } from "csv-parse";
import fs from "fs";
import { mapKeys, trim } from "lodash";
import { db } from "./drizzle";
import {
  normalizeStrings,
  nullifyEmpty,
  replaceStrings,
  transformDateFormat,
} from "./transformers";
import logger from "./logger";

// Keep keys sorted alphabetically for ease
const columnMapping = {
  assessableValue: "Assessable Value",
  basicAmount: "Basic Amount",
  basicRate: "Basic Rate",
  cgstAmount: "CGST Amount",
  cgstPct: "CGST %",
  commissionAmount: "Commission",
  commissionRate: "Commission Rate",
  contractNo: "Contract No.",
  divDescription: "Div. Description",
  ewayBillNo: "E-Way Bill Number",
  freightByCust: "Freight By Customer",
  freightByCustRate: "Freight By Cust Rate",
  freightByKciRate: "Freight By KCIL Rate",
  freightByKciValue: "Freight By KCIL Value",
  giDate: "G.I. Date",
  giNo: "G.I No.",
  gstTaxInvNo: "GST Tax Inv no",
  gstTaxInvoiceDate: "GST Tax Inv Date",
  hsnCode: "HSN Code",
  igstAmount: "IGST Amount",
  igstPct: "IGST %",
  incoterms: "Incoterm",
  incotermsDescription: "Incoterm Description",
  internalRefNo: "Internal Ref no",
  invItem: "Inv. Item.",
  invoiceCurrency: "Invoice Currency",
  invoiceDate: "Inv. Date",
  invoiceType: "Invoice Type",
  invoiceTypeDescription: "Invoice Type Description",
  invoiceValue: "Invoice Value",
  lrDate: "LR Date",
  lrNo: "LR No",
  materialCode: "Material Code",
  materialDescription: "Material Des.",
  materialDescription2: "Material Description",
  materialGroup: "Material Group",
  netRealisation: "Net Realisation",
  placeOfSupply: "Place of Supply",
  plant: "Plant",
  qty: "Qty",
  receiptVoucherDate: "Receipt Voucher Date",
  receiptVoucherNo: "Receipt Voucher no",
  recipient: "Reciepient",
  recipientCity: "Reciepient City",
  recipientGstRegNo: "Reciepient GST Reg no",
  recipientName: "Reciepient Name",
  salesOrg: "Sales Org",
  salesOrgDescription: "Sales Org Description",
  sgstAmount: "SGST Amount",
  sgstPct: "SGST %",
  soDate: "S.O. Date",
  soQty: "Sales Order Quantity",
  taxableValue: "Taxable Value",
  tcsAmount: "TCS Amt.",
  tcsSaleAmount: "TCS sale Amt.",
  transporterName: "Transporter Name",
  ugstAmount: "UGST Amount",
  ugstPct: "UGST %",
  uom: "UOM",
  vehicleNo: "Vehicle No.",
};

// Keep keys sorted alphabetically for ease
const columnTransformations: Partial<
  Record<keyof typeof columnMapping, any[]>
> = {
  giDate: [transformDateFormat],
  gstTaxInvoiceDate: [transformDateFormat],
  invoiceDate: [transformDateFormat],
  lrDate: [transformDateFormat],
  materialDescription: [
    normalizeStrings(["Steam", "Sodium Formate"]),
    replaceStrings([
      [/Formaldehyde.*37.*Drums/i, "Formaldehyde-37% in Drums"],
      [/Formaldehyde.*37/i, "Formaldehyde-37%"],
      [/Formaldehyde.*43/i, "Formaldehyde-43%"],
      [/Formaldehyde.*41/i, "Formaldehyde-41%"],
      [/Formaldehyde.*40/i, "Formaldehyde-40%"],
      [/Formaldehyde.*36.5/i, "Formaldehyde-36.5%"],
      [/Formaldehyde/i, "Formaldehyde-37%"],
      [/Anhydrous\s*Ammonia/i, "Andyhrous Ammonia"],
      [/Di.*Pentaerythritol/i, "Di-Pentaerythritol"],
      [/Pentaerythritol.*TG/i, "Pentaerythritol-TG"],
      [/Pentaerythritol.*NG/i, "Pentaerythritol-NG"],
      [/Pentaerythritol/i, "Pentaerythritol-TG"],
      [/Hexamine/i, "Hexamine"],
    ]),
  ],
  materialDescription2: [
    normalizeStrings(["Formaldehyde", "Hexamine"]),
    replaceStrings([[/Steam\s*Generation/i, "Steam"]]),
  ],
  receiptVoucherDate: [transformDateFormat],
  soDate: [transformDateFormat],
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

// Keep values sorted alphabetically for ease
const requiredColumns: (keyof typeof columnMapping)[] = [
  "basicAmount",
  "basicRate",
  "divDescription",
  "gstTaxInvoiceDate",
  "internalRefNo",
  "invoiceDate",
  "materialCode",
  "materialDescription",
  "materialDescription2",
  "qty",
  "recipient",
  "recipientCity",
  "recipientName",
  "salesOrg",
  "salesOrgDescription",
  "soDate",
  "soQty",
  "uom",
];

function doesRecordHaveRequiredData(record: any) {
  for (const column of requiredColumns) {
    if (record[column] == null) return false;
  }
  return true;
}

export async function insertSalesInvoicesFromCSV(filePath: string) {
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
    const internalRefNo = csvRecord["Internal Ref no"];
    logger.info(`Uploading record #${++i}, InternalRefNo '${internalRefNo}'`);
    let record;
    try {
      record = mapAndTransformCSVRecord(csvRecord);
    } catch (error) {
      logger.error(
        `Upload failed. Record #${++i}, InternalRefNo '${internalRefNo}'. Reason: ${error}`,
      );
      failedCount++;
    }

    if (record && doesRecordHaveRequiredData(record)) {
      try {
        await db
          .insert(salesInvoicesRawTable)
          .values(record)
          .onConflictDoUpdate({
            target: salesInvoicesRawTable.internalRefNo,
            set: record,
          });
      } catch (error) {
        logger.error(
          `Upload failed. Record #${++i}, InternalRefNo '${internalRefNo}'. Reason: ${error}`,
        );
        failedCount++;
      }
      uploadedCount++;
    } else {
      logger.warn(
        `Upload skipped. Record #${++i}, InternalRefNo '${internalRefNo}'. Reason: Missing field(s)`,
      );
      skippedCount++;
    }
  }

  logger.info("Summary");
  logger.info("=======");
  logger.info(`Uploaded : ${uploadedCount}`);
  logger.info(`Skipped  : ${skippedCount}`);
  logger.info(`Failed   : ${failedCount}`);
  logger.info(
    `Find details on skipped and failed uploads in .logs/data-ingestor.log`,
  );
}
