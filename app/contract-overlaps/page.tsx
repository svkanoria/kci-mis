import { getContractOverlaps } from "@/lib/api";
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

  const dataPromise = getContractOverlaps({
    from,
    to,
    product,
  });

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <HeaderTitleUpdater title="Sales Contract Overlaps" />
      <Filter
        initialFrom={from}
        initialTo={to}
        initialProduct={product}
        hidePeriod
        key={`${from}-${to}-${product}`}
      />
      <Suspense
        fallback={
          <div className="p-8 text-center text-muted-foreground animate-pulse">
            Loading sales contract overlap data...
          </div>
        }
      >
        <DataGrid queryResult={dataPromise} key={`${from}-${to}-${product}`} />
      </Suspense>
    </div>
  );
}
