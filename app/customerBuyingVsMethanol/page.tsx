import { Heading } from "@/components/typography/heading";
import { getCustomerBuyingVsMethanol } from "@/lib/api";
import { extractFilterParams } from "../_utils/filter";
import { Filter } from "../_components/filter";
import { DataGrid } from "@/app/customerBuyingVsMethanol/dataGrid";
import { Suspense } from "react";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { from, to, product } = extractFilterParams(resolvedSearchParams, {
    product: "C:Formaldehyde",
  });

  const data = getCustomerBuyingVsMethanol({
    from,
    to,
    product,
  });

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <Heading level="h1" className="mb-0!">
        Customer Buying vs Methanol
      </Heading>
      <Filter
        initialFrom={from}
        initialTo={to}
        initialProduct={product}
        hidePeriod
        key={`${from}-${to}-${product}`}
      />
      <Suspense fallback={<div>Loading...</div>}>
        <DataGrid data={data} />
      </Suspense>
    </div>
  );
}
