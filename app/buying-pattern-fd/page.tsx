import { getBuyingPatternFD } from "@/lib/api";
import { extractFilterParams } from "../_utils/filter";
import { ExtendedFilter } from "./extendedFilter";
import { DataGrid } from "@/app/buying-pattern-fd/dataGrid";
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

  const dataPromise = getBuyingPatternFD({
    from,
    to,
    product,
  });

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <HeaderTitleUpdater title="Buying Pattern - Formaldehyde" />
      <ExtendedFilter
        initialFrom={from}
        initialTo={to}
        initialProduct={product}
        key={`${from}-${to}-${product}`}
      />
      <Suspense fallback={<div>Loading...</div>}>
        <DataGrid queryResult={dataPromise} key={`${from}-${to}-${product}`} />
      </Suspense>
    </div>
  );
}
