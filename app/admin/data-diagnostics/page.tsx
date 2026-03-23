import { db } from "@/db/drizzle";
import {
  salesInvoicesRawTable,
  methanolPricesTable,
  destinationsTable,
} from "@/db/schema";
import { count, max, isNull } from "drizzle-orm";
import { Heading } from "@/components/typography/heading";
import { HeaderTitleUpdater } from "@/app/_components/headerTitleUpdater";
import { formatDate } from "@/lib/utils/date";
import { AdminHomeLink } from "../_components/adminHomeLink";

export const dynamic = "force-dynamic";

export default async function DataDiagnosticsPage() {
  const [lastInvoiceResult] = await db
    .select({ date: max(salesInvoicesRawTable.invDate) })
    .from(salesInvoicesRawTable);
  const lastInvoiceDate = lastInvoiceResult?.date;

  const [lastMethanolResult] = await db
    .select({ date: max(methanolPricesTable.date) })
    .from(methanolPricesTable);
  const lastMethanolDate = lastMethanolResult?.date;

  const [destinationsCountResult] = await db
    .select({ count: count() })
    .from(destinationsTable);
  const totalDestinations = destinationsCountResult?.count ?? 0;

  const [missingCoordsResult] = await db
    .select({ count: count() })
    .from(destinationsTable)
    .where(isNull(destinationsTable.coordinates));
  const missingCoordsCount = missingCoordsResult?.count ?? 0;

  return (
    <div className="flex flex-col gap-4 p-3">
      <HeaderTitleUpdater title="Data Diagnostics" />
      <h1 className="flex items-center text-2xl font-bold">
        <AdminHomeLink />
        Data Diagnostics
      </h1>
      <div className="flex justify-center">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 container max-w-3xl">
          <StatCard
            title="Latest Sales Invoice"
            value={
              lastInvoiceDate ? formatDate(new Date(lastInvoiceDate)) : "N/A"
            }
            description="Most recent record in database"
          />
          <StatCard
            title="Latest Methanol Price"
            value={
              lastMethanolDate ? formatDate(new Date(lastMethanolDate)) : "N/A"
            }
            description="Most recent record in database"
          />
          <StatCard
            title="Total Destinations"
            value={totalDestinations}
            description="Total records in database"
          />
          <StatCard
            title="Missing Coordinates"
            value={missingCoordsCount}
            description="Destinations without location data"
            alert={
              typeof missingCoordsCount === "number" && missingCoordsCount > 0
            }
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  alert = false,
}: {
  title: string;
  value: string | number;
  description: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-card text-card-foreground shadow-sm p-6 ${
        alert
          ? "border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900"
          : ""
      }`}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
          {title}
        </h3>
        <div
          className={`text-2xl font-bold ${
            alert ? "text-red-600 dark:text-red-400" : ""
          }`}
        >
          {value}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
