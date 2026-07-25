import { db } from "@/db/drizzle";
import { salesInvoicesRawTable, salesInvoicesDerivedTable } from "@/db/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import {
  CommonFilterParams,
  getRawCommonConditions,
  getDerivedCommonConditions,
} from "./utils";

export interface OverlapContractInfo {
  contractNo: string;
  contractDate: string | null;
  startDate: string;
  completionDate: string;
  totalQty: number;
  totalAmount: number;
  avgPrice: number; // Unit price (₹/MT)
  invoiceCount: number;
}

export interface OverlapInstance {
  prevContract: OverlapContractInfo;
  subsequentContract: OverlapContractInfo;
  overlapDays: number;
  isLowerPrice: boolean; // True if subsequent contract unit price < previous contract unit price
  priceDiff: number; // Difference: prevContract.avgPrice - subsequentContract.avgPrice
  priceDiffPct: number; // Percentage discount
}

export interface ConsigneeOverlapSummary {
  consigneeName: string;
  consigneeCity: string;
  consigneeRegion: string;
  totalContracts: number;
  overlapCount: number;
  lowerPriceOverlapCount: number; // Count of overlaps where subsequent contract has lower price
  totalQty: number;
  overlappingInstances: OverlapInstance[];
  allContracts: OverlapContractInfo[];
}

export async function getContractOverlaps(
  filters: Omit<CommonFilterParams, "period">
): Promise<ConsigneeOverlapSummary[]> {
  const rawConditions = getRawCommonConditions(filters);
  const derivedConditions = getDerivedCommonConditions(filters);

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
      consigneeName: filteredRawSq.consigneeName,
      consigneeCity: filteredRawSq.consigneeCity,
      consigneeRegion: filteredRawSq.consigneeRegion,
      contractNo: sql<string>`${filteredRawSq.contractNo}::text`,
      contractDate: filteredRawSq.contractDate,
      invDate: filteredRawSq.invDate,
      qty: sql<number>`sum(${qtyCol})`.mapWith(Number),
      amount: sql<number>`sum(${filteredRawSq.basicAmount})`.mapWith(Number),
      invoiceCount: sql<number>`count(*)`,
    })
    .from(filteredRawSq)
    .leftJoin(
      salesInvoicesDerivedTable,
      eq(filteredRawSq.id, salesInvoicesDerivedTable.rawId)
    )
    .where(and(...derivedConditions))
    .groupBy(
      filteredRawSq.consigneeName,
      filteredRawSq.consigneeCity,
      filteredRawSq.consigneeRegion,
      filteredRawSq.contractNo,
      filteredRawSq.contractDate,
      filteredRawSq.invDate
    )
    .orderBy(
      filteredRawSq.consigneeName,
      filteredRawSq.contractNo,
      filteredRawSq.invDate
    );

  const consigneeMap = new Map<
    string,
    {
      consigneeName: string;
      consigneeCity: string;
      consigneeRegion: string;
      contractsMap: Map<
        string,
        {
          contractNo: string;
          contractDate: string | null;
          startDate: string;
          completionDate: string;
          totalQty: number;
          totalAmount: number;
          invoiceCount: number;
        }
      >;
    }
  >();

  for (const row of rows) {
    let cObj = consigneeMap.get(row.consigneeName);
    if (!cObj) {
      cObj = {
        consigneeName: row.consigneeName,
        consigneeCity: row.consigneeCity,
        consigneeRegion: row.consigneeRegion,
        contractsMap: new Map(),
      };
      consigneeMap.set(row.consigneeName, cObj);
    }

    let contract = cObj.contractsMap.get(row.contractNo);
    if (!contract) {
      contract = {
        contractNo: row.contractNo,
        contractDate: row.contractDate,
        startDate: row.invDate,
        completionDate: row.invDate,
        totalQty: 0,
        totalAmount: 0,
        invoiceCount: 0,
      };
      cObj.contractsMap.set(row.contractNo, contract);
    }

    if (row.invDate < contract.startDate) contract.startDate = row.invDate;
    if (row.invDate > contract.completionDate) contract.completionDate = row.invDate;
    contract.totalQty += row.qty;
    contract.totalAmount += row.amount;
    contract.invoiceCount += Number(row.invoiceCount);
  }

  const result: ConsigneeOverlapSummary[] = [];

  for (const cObj of consigneeMap.values()) {
    const rawContracts = Array.from(cObj.contractsMap.values());
    const contractsList: OverlapContractInfo[] = rawContracts
      .map((c) => ({
        ...c,
        avgPrice: c.totalQty > 0 ? c.totalAmount / c.totalQty : 0,
      }))
      .sort(
        (a, b) =>
          a.startDate.localeCompare(b.startDate) ||
          (a.contractDate || "").localeCompare(b.contractDate || "") ||
          a.contractNo.localeCompare(b.contractNo)
      );

    const overlappingInstances: OverlapInstance[] = [];
    let lowerPriceOverlapCount = 0;

    for (let i = 0; i < contractsList.length; i++) {
      const prev = contractsList[i];
      const prevEnd = new Date(prev.completionDate).getTime();

      for (let j = i + 1; j < contractsList.length; j++) {
        const next = contractsList[j];
        const nextStart = new Date(next.startDate).getTime();

        // Strict overlap only: subsequent contract start date is STRICTLY BEFORE previous contract completion date
        if (next.startDate < prev.completionDate) {
          const overlapMs = Math.max(0, prevEnd - nextStart);
          const overlapDays = Math.floor(overlapMs / (1000 * 60 * 60 * 24));

          const priceDiff = prev.avgPrice - next.avgPrice;
          const priceDiffPct =
            prev.avgPrice > 0 ? (priceDiff / prev.avgPrice) * 100 : 0;
          const isLowerPrice = priceDiffPct >= 0.5; // Overlap is flagged only if price difference is 0.5% or more

          if (isLowerPrice) {
            lowerPriceOverlapCount++;
          }

          overlappingInstances.push({
            prevContract: prev,
            subsequentContract: next,
            overlapDays,
            isLowerPrice,
            priceDiff,
            priceDiffPct,
          });
        }
      }
    }

    const totalQty = contractsList.reduce((sum, c) => sum + c.totalQty, 0);

    result.push({
      consigneeName: cObj.consigneeName,
      consigneeCity: cObj.consigneeCity,
      consigneeRegion: cObj.consigneeRegion,
      totalContracts: contractsList.length,
      overlapCount: overlappingInstances.length,
      lowerPriceOverlapCount,
      totalQty,
      overlappingInstances,
      allContracts: contractsList,
    });
  }

  // Sort consignees in descending order of lowerPriceOverlapCount, then overlapCount, then totalContracts
  result.sort(
    (a, b) =>
      b.lowerPriceOverlapCount - a.lowerPriceOverlapCount ||
      b.overlapCount - a.overlapCount ||
      b.totalContracts - a.totalContracts
  );

  return result;
}
