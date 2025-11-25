import { Heading } from "@/components/typography/heading";
import { getTopCustomersByRate } from "@/lib/api";
import { ExtendedFilter } from "./extendedFilter";
import { extractFilterParams } from "../_utils/filter";
import { DataGrid } from "./dataGrid";
import { Suspense } from "react";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { from, to, product } = extractFilterParams(resolvedSearchParams);
  const qtyThreshold = resolvedSearchParams.qtyThreshold
    ? Number(resolvedSearchParams.qtyThreshold)
    : undefined;

  const data = getTopCustomersByRate(
    {
      from,
      to,
      product,
    },
    1000,
    qtyThreshold,
  );

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Heading level="h1">Top Customers By Rate</Heading>
      <ExtendedFilter
        initialFrom={from}
        initialTo={to}
        initialProduct={product}
        initialQtyThreshold={qtyThreshold}
        key={`${from}-${to}-${product}-${qtyThreshold}`}
      />
      <Suspense fallback={<div>Loading...</div>}>
        <DataGrid data={data} />
      </Suspense>
    </div>
  );
}
