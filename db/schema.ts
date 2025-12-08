import {
  bigint,
  boolean,
  date,
  decimal,
  integer,
  pgTable,
  pgView,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const salesInvoicesRawTable = pgTable("salesInvoicesRaw", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  assessableValue: decimal(),
  basicAmount: decimal(),
  basicRate: decimal(),
  cgstAmount: decimal(),
  cgstPct: decimal(),
  commissionRate: decimal(),
  commissionValue: decimal(),
  consignee: integer().notNull(),
  consigneeCity: varchar().notNull(),
  consigneeGstRegNo: varchar().notNull(),
  consigneeName: varchar().notNull(),
  consigneePlaceOfSupplyCode: integer().notNull(),
  consigneeRegion: varchar().notNull(),
  contractNo: bigint({ mode: "bigint" }),
  contractDate: date(),
  distChannel: varchar().notNull(),
  distChannelDescription: varchar().notNull(),
  division: varchar().notNull(),
  divDescription: varchar().notNull(),
  exchangeRate: decimal(),
  ewayBillNo: varchar(),
  freightByCustRate: decimal(),
  freightByCustValue: decimal(),
  freightByKciRate: decimal(),
  freightByKciValue: decimal(),
  giDate: date(),
  giNo: bigint({ mode: "bigint" }),
  gstTaxInvDate: date().notNull(),
  gstTaxInvNo: varchar().notNull(),
  hsnCode: integer(),
  igstAmount: decimal(),
  igstPct: decimal(),
  incoterms: varchar(),
  incotermsDescription: varchar(),
  internalRefNo: bigint({ mode: "bigint" }).notNull().unique(),
  invItem: integer(),
  invDate: date().notNull(),
  invoiceCurrency: varchar(),
  invoiceType: varchar(),
  invoiceTypeDescription: varchar(),
  invoiceValue: decimal(),
  lrDate: date(),
  lrNo: varchar(),
  materialCode: varchar().notNull(),
  materialDescription: varchar().notNull(),
  netRealisation: decimal(),
  netRealisationPerUnit: decimal(),
  placeOfSupply: varchar().notNull(),
  placeOfSupplyCode: integer().notNull(),
  plant: integer().notNull(),
  poNumber: varchar(),
  qty: decimal().notNull(),
  receiptVoucherDate: date(),
  receiptVoucherNo: varchar(),
  recipient: integer().notNull(),
  recipientCity: varchar().notNull(),
  recipientGstRegNo: varchar().notNull(),
  recipientName: varchar().notNull(),
  salesOrgDescription: varchar().notNull(),
  sgstAmount: decimal(),
  sgstPct: decimal(),
  soDate: date().notNull(),
  soQty: decimal().notNull(),
  taxableValue: decimal(),
  tcsAmount: decimal(),
  tcsSaleAmount: decimal(),
  transporterName: varchar(),
  ugstAmount: decimal(),
  ugstPct: decimal(),
  uom: varchar().notNull(),
  vehicleNo: varchar(),
});

export const methanolPricesTable = pgTable("methanolPrices", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  date: date().notNull().unique(),
  dailyIcisKandlaPrice: decimal(),
});

export const salesInvoicesDerivedTable = pgTable("salesInvoicesDerived", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  rawId: integer()
    .references(() => salesInvoicesRawTable.id)
    .unique(),
  // Normalization factor (eg. to convert 43% FD to 37% FD)
  normalizationFactor: decimal().notNull(),
  normBasicRate: decimal(),
  normNetRealisationPerUnit: decimal(),
  normQty: decimal().notNull(),
  // For example, FD 37%, 40% etc. all become 'Formaldehyde'
  productCategory: varchar().notNull(),
});

export const methanolPricesInterpolatedView = pgView(
  "methanolPricesInterpolated",
  {
    date: date().notNull(),
    dailyIcisKandlaPrice: decimal().notNull(),
    dailyIcisKandlaPriceForwardFill: decimal().notNull(),
    dailyIcisKandlaPriceBackwardFill: decimal().notNull(),
    isInterpolated: boolean().notNull(),
  },
).as(sql`
  WITH valid_prices AS (
      SELECT date, "dailyIcisKandlaPrice" as price
      FROM ${methanolPricesTable}
      WHERE "dailyIcisKandlaPrice" IS NOT NULL
  ),
  ordered_prices AS (
      SELECT
          date,
          price,
          LEAD(date) OVER (ORDER BY date) as next_date,
          LEAD(price) OVER (ORDER BY date) as next_price
      FROM valid_prices
  )
  SELECT
      t.day::date as date,
      COALESCE(
          op.price + (op.next_price - op.price) * (t.day::date - op.date)::numeric / NULLIF((op.next_date - op.date)::numeric, 0),
          op.price
      ) as "dailyIcisKandlaPrice",
      op.price as "dailyIcisKandlaPriceForwardFill",
      CASE WHEN t.day::date = op.date THEN op.price ELSE op.next_price END as "dailyIcisKandlaPriceBackwardFill",
      (t.day::date != op.date) as "isInterpolated"
  FROM ordered_prices op
  CROSS JOIN LATERAL generate_series(op.date::timestamp, COALESCE(op.next_date::timestamp - interval '1 day', op.date::timestamp), interval '1 day') as t(day)
`);
