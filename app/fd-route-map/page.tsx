import { Heading } from "@/components/typography/heading";
import { getSalesByRoute } from "@/lib/api";
import { Map } from "./lazyMap";
import { extractFilterParams } from "@/app/_utils/filter";
import { HeaderTitleUpdater } from "../_components/headerTitleUpdater";
import { ExtendedFilter } from "./extendedFilter";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { from, to, product } = extractFilterParams(resolvedSearchParams, {
    product: "C:Formaldehyde",
  });

  const routes = await getSalesByRoute({ from, to, product });

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      <HeaderTitleUpdater title="Routes - FD" />
      <ExtendedFilter
        initialFrom={from}
        initialTo={to}
        initialProduct={product}
        key={`${from}-${to}-${product}`}
      />
      <div className="grow min-h-0 border rounded-lg overflow-hidden relative z-0">
        <Map routes={routes} />
      </div>
    </div>
  );
}
