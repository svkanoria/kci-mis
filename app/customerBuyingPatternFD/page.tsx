import { Heading } from "@/components/typography/heading";
import { getCustomerBuyingPatternFD } from "@/lib/api";
import { extractFilterParams } from "../_utils/filter";
import { ExtendedFilter } from "./extendedFilter";
import { DataGrid } from "@/app/customerBuyingPatternFD/dataGrid";
import { Suspense } from "react";
import { HomeButton } from "../_components/homeButton";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { from, to, product } = extractFilterParams(resolvedSearchParams, {
    product: "C:Formaldehyde",
  });

  const dataPromise = getCustomerBuyingPatternFD({
    from,
    to,
    product,
  });

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className="flex items-center gap-4">
        <HomeButton />
        <Heading level="h1" className="mb-0!">
          Customer Buying vs Methanol
        </Heading>
      </div>
      <ExtendedFilter
        initialFrom={from}
        initialTo={to}
        initialProduct={product}
        key={`${from}-${to}-${product}`}
      />
      <Suspense fallback={<div>Loading...</div>}>
        <DataGrid queryResult={dataPromise} />
      </Suspense>
    </div>
  );
}
