import { getSalesByConsignee } from "@/lib/api";
import { Map } from "./lazyMap";
import { extractFilterParams } from "@/app/_utils/filter";
import { HeaderTitleUpdater } from "../_components/headerTitleUpdater";
import { Filter } from "@/app/_components/filter";
import { db } from "@/db/drizzle";
import { salesInvoicesRawTable } from "@/db/schema";
import { sql } from "drizzle-orm";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { from, to, product } = extractFilterParams(resolvedSearchParams, {
    product: "C:Formaldehyde",
  });

  let resolvedFrom = from;
  let resolvedTo = to;

  if (!resolvedFrom || !resolvedTo) {
    const [{ minDate, maxDate }] = await db
      .select({
        minDate: sql<string>`min(${salesInvoicesRawTable.invDate})`,
        maxDate: sql<string>`max(${salesInvoicesRawTable.invDate})`,
      })
      .from(salesInvoicesRawTable);

    if (!resolvedFrom && minDate) resolvedFrom = new Date(minDate);
    if (!resolvedTo && maxDate) resolvedTo = new Date(maxDate);
  }

  const salesPoints = await getSalesByConsignee({
    from: resolvedFrom,
    to: resolvedTo,
    product,
  });

  return (
    <div className="h-[calc(100vh-(--spacing(14)))] flex flex-col gap-4 p-4">
      <HeaderTitleUpdater title="Sales Clusters" />
      <Filter
        initialFrom={from}
        initialTo={to}
        initialProduct={product}
        hidePeriod
        key={`${from}-${to}-${product}`}
      />
      <div className="grow min-h-0 border rounded-lg overflow-hidden relative z-0">
        <Map
          salesPoints={salesPoints}
          from={resolvedFrom}
          to={resolvedTo}
          product={product}
        />
      </div>
    </div>
  );
}


