import { Heading } from "@/components/typography/heading";
import { getTopCustomers } from "@/lib/api";
import { extractFilterParams } from "../_utils/filter";
import { ExtendedFilter } from "./extendedFilter";
import { DataGrid } from "./dataGrid";
import { Suspense } from "react";
import { Period } from "@/lib/utils/date";
import { HomeButton } from "../_components/homeButton";

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

  const grouping =
    typeof resolvedSearchParams.grouping === "string"
      ? resolvedSearchParams.grouping
      : "none";

  const channels =
    typeof resolvedSearchParams.channels === "string"
      ? resolvedSearchParams.channels
      : "all";

  const data = getTopCustomers({
    from,
    to,
    period,
    product,
    grouping,
    channels,
  });

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className="flex items-center gap-4">
        <HomeButton />
        <Heading level="h1" className="mb-0!">
          Top Customers - Formaldehyde
        </Heading>
      </div>
      <ExtendedFilter
        initialFrom={from}
        initialTo={to}
        initialPeriod={period}
        initialProduct={product}
        initialGrouping={grouping}
        initialChannels={channels}
        key={`${from}-${to}-${product}-${period}-${grouping}-${channels}`}
      />
      <Suspense fallback={<div>Loading...</div>}>
        <DataGrid
          data={data}
          initialGrouping={grouping}
          key={`${from}-${to}-${product}-${period}-${grouping}-${channels}`}
        />
      </Suspense>
    </div>
  );
}
