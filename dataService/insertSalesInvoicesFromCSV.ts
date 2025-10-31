import { salesInvoicesRawTable } from "../db/schema";
import { parse } from "csv-parse";
import fs from "fs";
import { mapKeys, trim } from "lodash";
import { db } from "./drizzle";
import {
  normalizeStrings,
  nullifyEmpty,
  transformDateFormat,
} from "./transformers";

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
    normalizeStrings([
      "Formaldehyde",
      "Formaldehyde-37%",
      "Formaldehyde-36.5%",
      "Formaldehyde-40%",
      "Formaldehyde-43%",
      "Hexamine",
    ]),
  ],
  materialDescription2: [normalizeStrings(["Formaldehyde", "Hexamine"])],
};

function applyTransformations(value: any, transformers: any[] | undefined) {
  const augmentedTransformers = [nullifyEmpty, trim, ...(transformers ?? [])];
  return augmentedTransformers.reduce(
    (acc, transformer) => (acc == null ? acc : transformer(acc)),
    value,
  );
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

  // Map CSV columns to schema fields
  const mappedRecords = records.map((record) => {
    const mappedRecord: any = {};
    for (const [schemaColumn, csvColumn] of Object.entries(columnMapping)) {
      mappedRecord[schemaColumn] = applyTransformations(
        record[csvColumn],
        columnTransformations[schemaColumn as keyof typeof columnMapping],
      );
    }
    return mappedRecord;
  });

  // Insert mapped records into the database
  for (const record of mappedRecords) {
    if (doesRecordHaveRequiredData(record)) {
      await db.insert(salesInvoicesRawTable).values(record);
    }
  }
}
