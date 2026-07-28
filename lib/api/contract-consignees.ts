import { db } from "@/db/drizzle";
import {
  CommonFilterParams,
  getDerivedCommonConditions,
  getRawCommonConditions,
} from "./utils";
import { salesInvoicesDerivedTable, salesInvoicesRawTable } from "@/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";

export async function getContractConsignees(
  filters: Omit<CommonFilterParams, "period">,
) {
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

  const rows = db
    .select({
      contractNo: salesInvoicesRawTable.contractNo,
      contractDate: salesInvoicesRawTable.contractDate,
      recipientName: salesInvoicesRawTable.recipientName,
      consigneeName: salesInvoicesRawTable.consigneeName,
      consigneeCity: salesInvoicesRawTable.consigneeCity,
      consigneeRegion: salesInvoicesRawTable.consigneeRegion,
      qty: qtyCol,
      basicAmount: salesInvoicesRawTable.basicAmount,
    })
    .from(salesInvoicesRawTable)
    .leftJoin(
      salesInvoicesDerivedTable,
      eq(salesInvoicesRawTable.id, salesInvoicesDerivedTable.rawId),
    )
    .where(and(...getDerivedCommonConditions(filters)));
}
