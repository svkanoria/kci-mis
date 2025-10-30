import { drizzle } from "drizzle-orm/node-postgres";
import { salesInvoicesRawTable } from "@/db/schema";
import { parse } from "csv-parse";
import fs from "fs";

const db = drizzle(process.env.DATABASE_URL!);

const columnMapping = {
  "Inv. Date": "invoiceDate",
  "GST Tax Inv Date": "gstTaxInvoiceDate",
  Reciepient: "recipient",
  "Reciepient Name": "recipientName",
  Plant: "plant",
  "Material Des.": "materialDescription",
  Qty: "qty",
  "Freight By Cust Rate": "freightByCustRate",
  "Freight By KCIL Rate": "freightByKciRate",
  "Freight By KCIL Value": "freightByKciValue",
  "Transporter Name": "transporterName",
  "LR No": "lrNo",
  "LR Date": "lrDat",
  "Vehicle No.": "vehicleNo",
  "Reciepient City": "recipientCity",
  "Place of Supply": "placeOfSupply",
  "Sales Org": "salesOrg",
  "Sales Org Description": "salesOrgDescription",
  "Div. Description": "divDescription",
  "Contract No.": "contractNo",
  "Internal Ref no": "internalRefNo",
  "Inv. Item.": "invItem",
  "Invoice Type": "invoiceType",
  "Invoice Type Description": "invoiceTypeDescription",
  Incoterm: "incoterms",
  "Incoterm Description": "incotermsDescription",
  "S.O. Date": "soDate",
  "Sales Order Quantity": "soQty",
  "G.I No.": "giNo",
  "G.I. Date": "giDate",
  "GST Tax Inv no": "gstTaxInvNo",
  "Reciepient GST Reg no": "recipientGstRegNo",
  "Material Code": "materialCode",
  "HSN Code": "hsnCode",
  "Invoice Currency": "invoiceCurrency",
  "Basic Rate": "basicRate",
  "Basic Amount": "basicAmount",
  "Receipt Voucher no": "receiptVoucherNo",
  "Receipt Voucher Date": "receiptVoucherDate",
  "Freight By Customer": "freightByCust",
  "Taxable Value": "taxableValue",
  "Commission Rate": "commissionRate",
  Commission: "commissionAmount",
  "Assessable Value": "assessableValue",
  "SGST %": "sgstPct",
  "SGST Amount": "sgstAmount",
  "CGST %": "cgstPct",
  "CGST Amount": "cgstAmount",
  "IGST %": "igstPct",
  "IGST Amount": "igstAmount",
  "UGST %": "ugstPct",
  "UGST Amount": "ugstAmount",
  "TCS Amt.": "tcsAmount",
  "TCS sale Amt.": "tcsSaleAmount",
  "Invoice Value": "invoiceValue",
  "Net Realisation": "netRealisation",
  "E-Way Bill Number": "ewayBillNo",
  "Material Group": "materialGroup",
  "Material Description": "materialDescription2",
  UOM: "uom",
};

export async function insertSalesInvoicesFromCSV(filePath: string) {
  const records: any[] = [];

  // Read and parse the CSV file
  const parser = fs.createReadStream(filePath).pipe(parse({ columns: true }));
  for await (const record of parser) {
    records.push(record);
  }

  // Map CSV columns to schema fields
  const mappedRecords = records.map((record) => {
    const mappedRecord: any = {};
    for (const [csvColumn, schemaField] of Object.entries(columnMapping)) {
      mappedRecord[schemaField] = record[csvColumn];
    }
    return mappedRecord;
  });

  // Insert mapped records into the database
  for (const record of mappedRecords) {
    await db.insert(salesInvoicesRawTable).values(record);
  }
}
