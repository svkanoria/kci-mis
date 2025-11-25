import { Heading } from "@/components/typography/heading";
import { getTopCustomersByVolume } from "@/lib/api";
import { extractFilterParams } from "../_utils/filter";
import { Filter } from "../_components/filter";
import { DataGrid } from "./dataGrid";
import { Suspense } from "react";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { from, to, product } = extractFilterParams(await searchParams);

  const data = getTopCustomersByVolume(
    {
      from,
      to,
      product,
    },
    1000,
  );

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Heading level="h1">Top Customers By Volume</Heading>
      <Filter
        initialFrom={from}
        initialTo={to}
        initialProduct={product}
        key={`${from}-${to}-${product}`}
      />
      <Suspense fallback={<div>Loading...</div>}>
        <DataGrid data={data} />
      </Suspense>
    </div>
  );
}
