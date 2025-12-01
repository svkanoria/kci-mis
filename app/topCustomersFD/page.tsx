import { Heading } from "@/components/typography/heading";
import { getTopCustomers } from "@/lib/api";
import { extractFilterParams } from "../_utils/filter";
import { ExtendedFilter } from "./extendedFilter";
import { DataGrid } from "./dataGrid";
import { Suspense } from "react";
import { Period } from "@/lib/utils/date";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { from, to, product } = extractFilterParams(resolvedSearchParams);

  const periodParam = resolvedSearchParams.period;
  const period = (
    typeof periodParam === "string" &&
    ["month", "quarter", "year"].includes(periodParam)
      ? periodParam
      : "month"
  ) as Period;

  const data = getTopCustomers(
    {
      from,
      to,
      product,
    },
    period,
  );

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <Heading level="h1" className="mb-0!">
        Top Customers - Formaldehyde
      </Heading>
      <ExtendedFilter
        initialFrom={from}
        initialTo={to}
        initialProduct={product}
        initialPeriod={period}
        key={`${from}-${to}-${product}-${period}`}
      />
      <Suspense fallback={<div>Loading...</div>}>
        <DataGrid data={data} />
      </Suspense>
    </div>
  );
}
