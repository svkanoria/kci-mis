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
const columnMapping: Record<
  Exclude<keyof typeof salesInvoicesRawTable.$inferSelect, "id">,
  string
> = {
  assessableValue: "Assessable Value",
  basicAmount: "Basic Amount",
  basicRate: "Basic Rate",
  cgstAmount: "CGST Amount",
  cgstPct: "CGST %",
  commissionRate: "Commission Rate",
  commissionValue: "Commission",
  consignee: "Consignee",
  consigneeCity: "Consignee City",
  consigneeGstRegNo: "Consignee GST Reg no",
  consigneeName: "Consignee Name",
  consigneePlaceOfSupplyCode: "Consignee Place Of Supply Code",
  consigneeRegion: "Consignee Region",
  contractDate: "Contract Date",
  contractNo: "Contract No.",
  distChannel: "Dist. Channel",
  distChannelDescription: "Dist. Chan Description",
  divDescription: "Div. Description",
  division: "Division",
  ewayBillNo: "E-Way Bill Number",
  exchangeRate: "Exchange Rate",
  freightByCustRate: "Freight By Cust Rate",
  freightByCustValue: "Freight By Customer",
  freightByKciRate: "Freight By KCIL Rate",
  freightByKciValue: "Freight By KCIL Value",
  giDate: "G.I. Date",
  giNo: "G.I No.",
  gstTaxInvDate: "GST Tax Inv Date",
  gstTaxInvNo: "GST Tax Inv no",
  hsnCode: "HSN Code",
  igstAmount: "IGST Amount",
  igstPct: "IGST %",
  incoterms: "Incoterm",
  incotermsDescription: "Incoterm Description",
  internalRefNo: "Internal Ref no",
  invItem: "Inv. Item.",
  invoiceCurrency: "Invoice Currency",
  invDate: "Inv. Date",
  invoiceType: "Invoice Type",
  invoiceTypeDescription: "Invoice Type Description",
  invoiceValue: "Invoice Value",
  lrDate: "LR Date",
  lrNo: "LR No",
  materialCode: "Material Code",
  materialDescription: "Material Des.",
  netRealisation: "Net Realisation",
  netRealisationPerUnit: "Net Reali./MT",
  placeOfSupply: "Place of Supply",
  placeOfSupplyCode: "Place of Supply Code",
  plant: "Plant",
  poNumber: "Purchase Order No.",
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
  gstTaxInvDate: [transformDateFormat],
  invDate: [transformDateFormat],
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
  "consignee",
  "consigneeCity",
  "consigneeGstRegNo",
  "consigneeName",
  "consigneePlaceOfSupplyCode",
  "consigneeRegion",
  "distChannel",
  "distChannelDescription",
  "division",
  "divDescription",
  "gstTaxInvDate",
  "gstTaxInvNo",
  "internalRefNo",
  "invDate",
  "materialCode",
  "materialDescription",
  "placeOfSupply",
  "placeOfSupplyCode",
  "plant",
  "qty",
  "recipient",
  "recipientCity",
  "recipientGstRegNo",
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
