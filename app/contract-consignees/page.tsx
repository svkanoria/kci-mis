import { getContractConsignees } from "@/lib/api";
import { extractFilterParams } from "../_utils/filter";
import { Filter } from "../_components/filter";
import { DataGrid } from "./dataGrid";
import { Suspense } from "react";
import { HeaderTitleUpdater } from "../_components/headerTitleUpdater";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { from, to, product } = extractFilterParams(resolvedSearchParams, {
    product: "C:Formaldehyde",
  });

  const data = getContractConsignees({
    from,
    to,
    product,
  });

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <HeaderTitleUpdater title="Contract Consignees" />
      <Filter
        initialFrom={from}
        initialTo={to}
        initialProduct={product}
        hidePeriod
        key={`${from}-${to}-${product}`}
      />
      <Suspense fallback={<div className="p-4 text-muted-foreground">Loading contract consignees...</div>}>
        <DataGrid data={data} key={`${from}-${to}-${product}`} product={product} />
      </Suspense>
    </div>
  );
}
