import { db } from "@/db/drizzle";
import {
  CommonFilterParams,
  getDerivedCommonConditions,
  getRawCommonConditions,
} from "./utils";
import { salesInvoicesDerivedTable, salesInvoicesRawTable } from "@/db/schema";
import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { parseISO, format, addDays, subDays, isAfter } from "date-fns";

export interface Consignee {
  consigneeName: string;
  consigneeCity: string;
  consigneeRegion: string;
  totalQty: number;
  totalBasicAmount: number;
  avgBasicPrice: number;
  firstInvDate: string | null;
  lastInvDate: string | null;
}

export interface Contract {
  contractNo: string;
  contractDate: string | null;
  recipientName: string;
  totalQty: number;
  totalBasicAmount: number;
  avgBasicPrice: number;
  firstInvDate: string | null;
  lastInvDate: string | null;
  consignees: Consignee[];
}

export interface ConsigneePriceAnalysisParams {
  city: string;
  region: string;
  firstInvDate: string;
  lastInvDate: string;
  product?: string;
  clickedConsigneeName?: string;
}

export interface ConsigneePriceCell {
  price: number;
  recipientNames: string[];
}

export interface ConsigneePriceRow {
  consigneeName: string;
  prices: Record<string, ConsigneePriceCell | null>;
  totalQty: number;
  totalBasicAmount: number;
  avgPrice: number;
}

export interface ConsigneePriceAnalysisResult {
  city: string;
  region: string;
  firstInvDate: string;
  lastInvDate: string;
  startDate: string;
  endDate: string;
  product?: string;
  dates: string[];
  consignees: ConsigneePriceRow[];
}

export async function getContractConsignees(
  filters: Omit<CommonFilterParams, "period">,
): Promise<Contract[]> {
  const rawConditions = getRawCommonConditions(filters);

  const filteredRawSq = db
    .select()
    .from(salesInvoicesRawTable)
    .where(and(...rawConditions, isNotNull(salesInvoicesRawTable.contractNo)))
    .as("filtered_raw");

  const isCategoryFilter = filters.product?.startsWith("C:");

  const qtyCol = isCategoryFilter
    ? salesInvoicesDerivedTable.normQty
    : filteredRawSq.qty;

  const rows = await db
    .select({
      contractNo: sql<string>`${filteredRawSq.contractNo}::text`,
      contractDate: filteredRawSq.contractDate,
      recipientName: filteredRawSq.recipientName,
      consigneeName: filteredRawSq.consigneeName,
      consigneeCity: filteredRawSq.consigneeCity,
      consigneeRegion: filteredRawSq.consigneeRegion,
      qty: sql<number>`sum(${qtyCol})`.mapWith(Number),
      basicAmount: sql<number>`sum(${filteredRawSq.basicAmount})`.mapWith(
        Number,
      ),
      firstInvDate: sql<string | null>`min(${filteredRawSq.invDate})`,
      lastInvDate: sql<string | null>`max(${filteredRawSq.invDate})`,
    })
    .from(filteredRawSq)
    .leftJoin(
      salesInvoicesDerivedTable,
      eq(filteredRawSq.id, salesInvoicesDerivedTable.rawId),
    )
    .where(and(...getDerivedCommonConditions(filters)))
    .groupBy(
      filteredRawSq.contractNo,
      filteredRawSq.contractDate,
      filteredRawSq.recipientName,
      filteredRawSq.consigneeName,
      filteredRawSq.consigneeCity,
      filteredRawSq.consigneeRegion,
    )
    .orderBy(filteredRawSq.contractNo);

  const result: Contract[] = [];
  let currentContract: Contract | null = null;

  for (const row of rows) {
    if (!currentContract || currentContract.contractNo !== row.contractNo) {
      currentContract = {
        contractNo: row.contractNo,
        contractDate: row.contractDate,
        recipientName: row.recipientName,
        totalQty: 0,
        totalBasicAmount: 0,
        avgBasicPrice: 0,
        firstInvDate: row.firstInvDate,
        lastInvDate: row.lastInvDate,
        consignees: [],
      };
      result.push(currentContract);
    }

    currentContract.totalQty += row.qty;
    currentContract.totalBasicAmount += row.basicAmount;

    if (
      row.firstInvDate &&
      (!currentContract.firstInvDate ||
        row.firstInvDate < currentContract.firstInvDate)
    ) {
      currentContract.firstInvDate = row.firstInvDate;
    }

    if (
      row.lastInvDate &&
      (!currentContract.lastInvDate ||
        row.lastInvDate > currentContract.lastInvDate)
    ) {
      currentContract.lastInvDate = row.lastInvDate;
    }

    const consigneeAvgBasicPrice = row.qty > 0 ? row.basicAmount / row.qty : 0;

    currentContract.consignees.push({
      consigneeName: row.consigneeName,
      consigneeCity: row.consigneeCity,
      consigneeRegion: row.consigneeRegion,
      totalQty: row.qty,
      totalBasicAmount: row.basicAmount,
      avgBasicPrice: consigneeAvgBasicPrice,
      firstInvDate: row.firstInvDate,
      lastInvDate: row.lastInvDate,
    });
  }

  for (const contract of result) {
    contract.avgBasicPrice =
      contract.totalQty > 0 ? contract.totalBasicAmount / contract.totalQty : 0;
  }

  return result;
}

export async function getConsigneePriceAnalysis(
  params: ConsigneePriceAnalysisParams,
): Promise<ConsigneePriceAnalysisResult> {
  const {
    city,
    region,
    firstInvDate,
    lastInvDate,
    product,
    clickedConsigneeName,
  } = params;

  if (!firstInvDate || !lastInvDate) {
    return {
      city,
      region,
      firstInvDate: firstInvDate || "",
      lastInvDate: lastInvDate || "",
      startDate: "",
      endDate: "",
      product,
      dates: [],
      consignees: [],
    };
  }

  // Calculate expanded date range: 3 days prior and 3 days subsequent
  const startDate = format(subDays(parseISO(firstInvDate), 3), "yyyy-MM-dd");
  const endDate = format(addDays(parseISO(lastInvDate), 3), "yyyy-MM-dd");

  const dates: string[] = [];
  let current = parseISO(startDate);
  const end = parseISO(endDate);

  while (!isAfter(current, end)) {
    dates.push(format(current, "yyyy-MM-dd"));
    current = addDays(current, 1);
  }

  const rawConditions = [
    eq(salesInvoicesRawTable.consigneeCity, city),
    eq(salesInvoicesRawTable.consigneeRegion, region),
    gte(salesInvoicesRawTable.invDate, startDate),
    lte(salesInvoicesRawTable.invDate, endDate),
  ];

  if (product && !product.startsWith("C:")) {
    rawConditions.push(eq(salesInvoicesRawTable.materialDescription, product));
  }

  const derivedConditions = [];
  if (product && product.startsWith("C:")) {
    derivedConditions.push(
      eq(salesInvoicesDerivedTable.productCategory, product.slice(2)),
    );
  }

  const isCategoryFilter = product?.startsWith("C:");
  const qtyCol = isCategoryFilter
    ? salesInvoicesDerivedTable.normQty
    : salesInvoicesRawTable.qty;

  const rows = await db
    .select({
      consigneeName: salesInvoicesRawTable.consigneeName,
      invDate: salesInvoicesRawTable.invDate,
      recipientName: salesInvoicesRawTable.recipientName,
      qty: sql<number>`sum(${qtyCol})`.mapWith(Number),
      basicAmount:
        sql<number>`sum(${salesInvoicesRawTable.basicAmount})`.mapWith(Number),
    })
    .from(salesInvoicesRawTable)
    .leftJoin(
      salesInvoicesDerivedTable,
      eq(salesInvoicesRawTable.id, salesInvoicesDerivedTable.rawId),
    )
    .where(and(...rawConditions, ...derivedConditions))
    .groupBy(
      salesInvoicesRawTable.consigneeName,
      salesInvoicesRawTable.invDate,
      salesInvoicesRawTable.recipientName,
    )
    .orderBy(
      salesInvoicesRawTable.consigneeName,
      salesInvoicesRawTable.invDate,
    );

  const consigneeMap = new Map<
    string,
    {
      consigneeName: string;
      prices: Map<
        string,
        { qty: number; basicAmount: number; recipientNames: Set<string> }
      >;
      totalQty: number;
      totalBasicAmount: number;
    }
  >();

  for (const row of rows) {
    let entry = consigneeMap.get(row.consigneeName);
    if (!entry) {
      entry = {
        consigneeName: row.consigneeName,
        prices: new Map(),
        totalQty: 0,
        totalBasicAmount: 0,
      };
      consigneeMap.set(row.consigneeName, entry);
    }
    let dateData = entry.prices.get(row.invDate);
    if (!dateData) {
      dateData = {
        qty: 0,
        basicAmount: 0,
        recipientNames: new Set<string>(),
      };
      entry.prices.set(row.invDate, dateData);
    }

    dateData.qty += row.qty;
    dateData.basicAmount += row.basicAmount;
    if (row.recipientName) {
      dateData.recipientNames.add(row.recipientName);
    }

    entry.totalQty += row.qty;
    entry.totalBasicAmount += row.basicAmount;
  }

  const consignees: ConsigneePriceRow[] = Array.from(consigneeMap.values()).map(
    (c) => {
      const pricesObj: Record<string, ConsigneePriceCell | null> = {};
      for (const d of dates) {
        const dateData = c.prices.get(d);
        if (dateData && dateData.qty > 0) {
          pricesObj[d] = {
            price: dateData.basicAmount / dateData.qty,
            recipientNames: Array.from(dateData.recipientNames).sort(),
          };
        } else {
          pricesObj[d] = null;
        }
      }

      return {
        consigneeName: c.consigneeName,
        prices: pricesObj,
        totalQty: c.totalQty,
        totalBasicAmount: c.totalBasicAmount,
        avgPrice: c.totalQty > 0 ? c.totalBasicAmount / c.totalQty : 0,
      };
    },
  );

  consignees.sort((a, b) => {
    if (clickedConsigneeName) {
      if (a.consigneeName === clickedConsigneeName) return -1;
      if (b.consigneeName === clickedConsigneeName) return 1;
    }
    return b.totalQty - a.totalQty;
  });

  return {
    city,
    region,
    firstInvDate,
    lastInvDate,
    startDate,
    endDate,
    product,
    dates,
    consignees,
  };
}

