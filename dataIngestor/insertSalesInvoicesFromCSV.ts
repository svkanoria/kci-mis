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

const columnMapping = {
  invoiceDate: "Inv. Date",
  gstTaxInvoiceDate: "GST Tax Inv Date",
  recipient: "Reciepient",
  recipientName: "Reciepient Name",
  plant: "Plant",
  materialDescription: "Material Des.",
  qty: "Qty",
  freightByCustRate: "Freight By Cust Rate",
  freightByKciRate: "Freight By KCIL Rate",
  freightByKciValue: "Freight By KCIL Value",
  transporterName: "Transporter Name",
  lrNo: "LR No",
  lrDate: "LR Date",
  vehicleNo: "Vehicle No.",
  recipientCity: "Reciepient City",
  placeOfSupply: "Place of Supply",
  salesOrg: "Sales Org",
  salesOrgDescription: "Sales Org Description",
  divDescription: "Div. Description",
  contractNo: "Contract No.",
  internalRefNo: "Internal Ref no",
  invItem: "Inv. Item.",
  invoiceType: "Invoice Type",
  invoiceTypeDescription: "Invoice Type Description",
  incoterms: "Incoterm",
  incotermsDescription: "Incoterm Description",
  soDate: "S.O. Date",
  soQty: "Sales Order Quantity",
  giNo: "G.I No.",
  giDate: "G.I. Date",
  gstTaxInvNo: "GST Tax Inv no",
  recipientGstRegNo: "Reciepient GST Reg no",
  materialCode: "Material Code",
  hsnCode: "HSN Code",
  invoiceCurrency: "Invoice Currency",
  basicRate: "Basic Rate",
  basicAmount: "Basic Amount",
  receiptVoucherNo: "Receipt Voucher no",
  receiptVoucherDate: "Receipt Voucher Date",
  freightByCust: "Freight By Customer",
  taxableValue: "Taxable Value",
  commissionRate: "Commission Rate",
  commissionAmount: "Commission",
  assessableValue: "Assessable Value",
  sgstPct: "SGST %",
  sgstAmount: "SGST Amount",
  cgstPct: "CGST %",
  cgstAmount: "CGST Amount",
  igstPct: "IGST %",
  igstAmount: "IGST Amount",
  ugstPct: "UGST %",
  ugstAmount: "UGST Amount",
  tcsAmount: "TCS Amt.",
  tcsSaleAmount: "TCS sale Amt.",
  invoiceValue: "Invoice Value",
  netRealisation: "Net Realisation",
  ewayBillNo: "E-Way Bill Number",
  materialGroup: "Material Group",
  materialDescription2: "Material Description",
  uom: "UOM",
};

const columnTransformations: Partial<
  Record<keyof typeof columnMapping, any[]>
> = {
  invoiceDate: [transformDateFormat],
  gstTaxInvoiceDate: [transformDateFormat],
  lrDate: [transformDateFormat],
  soDate: [transformDateFormat],
  giDate: [transformDateFormat],
  receiptVoucherDate: [transformDateFormat],
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

const requiredColumns: (keyof typeof columnMapping)[] = [
  "invoiceDate",
  "gstTaxInvoiceDate",
  "recipient",
  "recipientName",
  "materialDescription",
  "qty",
  "recipientCity",
  "salesOrg",
  "salesOrgDescription",
  "divDescription",
  "internalRefNo",
  "soDate",
  "soQty",
  "materialCode",
  "basicRate",
  "basicAmount",
  "materialDescription2",
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
