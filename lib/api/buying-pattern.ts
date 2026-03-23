import { db } from "@/db/drizzle";
import {
  salesInvoicesRawTable,
  salesInvoicesDerivedTable,
  methanolPricesInterpolatedView,
} from "@/db/schema";
import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { formatDate } from "@/lib/utils/date";
import { addDays } from "date-fns";
import {
  CommonFilterParams,
  getRawCommonConditions,
  getDerivedCommonConditions,
} from "./utils";

export async function getBuyingPatternFD(
  filters: Omit<CommonFilterParams, "period">,
) {
  const rawConditions = getRawCommonConditions(filters, {
    dateField: "contractDate",
  });

  const filteredRawSq = db
    .select()
    .from(salesInvoicesRawTable)
    .where(and(...rawConditions, isNotNull(salesInvoicesRawTable.contractDate)))
    .as("filtered_raw");

  const isCategoryFilter = filters.product?.startsWith("C:");

  const qtyCol = isCategoryFilter
    ? salesInvoicesDerivedTable.normQty
    : filteredRawSq.qty;

  const rows = await db
    .select({
      consigneeName: filteredRawSq.consigneeName,
      contractDate: filteredRawSq.contractDate,
      invDate: filteredRawSq.invDate,
      qty: sql<number>`sum(${qtyCol})`.mapWith(Number).as("qty"),
    })
    .from(filteredRawSq)
    .leftJoin(
      salesInvoicesDerivedTable,
      eq(filteredRawSq.id, salesInvoicesDerivedTable.rawId),
    )
    .where(and(...getDerivedCommonConditions(filters)))
    .groupBy(
      filteredRawSq.consigneeName,
      filteredRawSq.contractDate,
      filteredRawSq.invDate,
    )
    .orderBy(
      filteredRawSq.consigneeName,
      filteredRawSq.contractDate,
      filteredRawSq.invDate,
    );

  if (rows.length === 0) {
    return { data: [], methanolPrices: [] };
  }

  const [{ minDate: minDateStr, maxDate: maxDateStr }] = await db
    .select({
      // At this point, we know there is at least one row, hence
      // we are sure minDateStr and maxDateStr won't be null
      minDate: sql<string>`min(${salesInvoicesRawTable.contractDate})`,
      maxDate: sql<string>`max(${salesInvoicesRawTable.invDate})`,
    })
    .from(salesInvoicesRawTable);
  const minMethanolDate = addDays(new Date(minDateStr), -15);
  const maxMethanolDate = new Date(maxDateStr);

  const methanolPrices = await db
    .select({
      date: methanolPricesInterpolatedView.date,
      price: sql<number>`${methanolPricesInterpolatedView.dailyIcisKandlaPrice}`
        .mapWith(Number)
        .as("price"),
    })
    .from(methanolPricesInterpolatedView)
    .where(
      and(
        gte(methanolPricesInterpolatedView.date, formatDate(minMethanolDate)),
        lte(methanolPricesInterpolatedView.date, formatDate(maxMethanolDate)),
      ),
    )
    .orderBy(methanolPricesInterpolatedView.date);

  const methanolPriceMap = new Map<string, number>();
  methanolPrices.forEach((p) => {
    methanolPriceMap.set(p.date, Number(p.price));
  });

  let data: {
    consigneeName: string;
    contractDate: string;
    contractQty: number;
    contractMethanolPrice: number;
    gain: number;
    firstLiftingDate: string;
    finalLiftingDate: string;
    invoices: {
      date: string;
      qty: number;
      methanolPrice: number;
      gain: number;
    }[];
  }[] = [];

  let currContract: (typeof data)[number] | null = null;

  for (const row of rows) {
    if (
      !currContract ||
      currContract.consigneeName !== row.consigneeName ||
      currContract.contractDate !== row.contractDate
    ) {
      currContract = {
        consigneeName: row.consigneeName,
        contractDate: row.contractDate!,
        contractQty: 0,
        contractMethanolPrice: methanolPriceMap.get(row.contractDate!)!,
        gain: 0,
        firstLiftingDate: row.invDate!,
        finalLiftingDate: row.invDate!,
        invoices: [],
      };
      data.push(currContract);
    }

    const currentMethanolPrice = methanolPriceMap.get(row.invDate!)!;

    const invoiceGain =
      ((row.qty * (currentMethanolPrice - currContract.contractMethanolPrice)) /
        2) *
      1000;
    currContract.invoices.push({
      date: row.invDate!,
      qty: row.qty,
      methanolPrice: currentMethanolPrice,
      gain: invoiceGain,
    });
    currContract.contractQty += row.qty;
    currContract.gain += invoiceGain;
    currContract.finalLiftingDate = row.invDate!;
  }

  return { data, methanolPrices };
}
