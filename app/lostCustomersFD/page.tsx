import { Heading } from "@/components/typography/heading";
import { getLostCustomers } from "@/lib/api";
import { extractFilterParams } from "../_utils/filter";
import { ExtendedFilter } from "./extendedFilter";
import { DataGrid } from "./dataGrid";
import { Suspense } from "react";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { product } = extractFilterParams(resolvedSearchParams, {
    product: "C:Formaldehyde",
  });

  const data = await getLostCustomers({
    product,
  });

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <Heading level="h1" className="mb-0!">
        Lost Customers - Formaldehyde
      </Heading>
      <ExtendedFilter initialProduct={product} key={`${product}`} />
      <Suspense fallback={<div>Loading...</div>}>
        <DataGrid data={data} />
      </Suspense>
    </div>
  );
}
