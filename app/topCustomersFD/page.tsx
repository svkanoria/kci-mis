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
  const { from, to, period, product } = extractFilterParams(
    resolvedSearchParams,
    { period: "month" as Period, product: "C:Formaldehyde" },
  );

  const customerLevel =
    typeof resolvedSearchParams.customerLevel === "string"
      ? resolvedSearchParams.customerLevel
      : "consignee";

  const data = getTopCustomers({
    from,
    to,
    period,
    product,
  });

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <Heading level="h1" className="mb-0!">
        Top Customers - Formaldehyde
      </Heading>
      <ExtendedFilter
        initialFrom={from}
        initialTo={to}
        initialPeriod={period}
        initialProduct={product}
        initialCustomerLevel={customerLevel}
        key={`${from}-${to}-${product}-${period}-${customerLevel}`}
      />
      <Suspense fallback={<div>Loading...</div>}>
        <DataGrid data={data} />
      </Suspense>
    </div>
  );
}
