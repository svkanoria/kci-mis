import { getDestinations } from "@/lib/api";
import { DataGrid } from "./dataGrid";
import { HeaderTitleUpdater } from "../../_components/headerTitleUpdater";
import { AdminHomeLink } from "../_components/adminHomeLink";

export const dynamic = "force-dynamic";

export default async function Page() {
  const destinations = await getDestinations();

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <HeaderTitleUpdater title="Destination Management" />
      <h1 className="flex items-center text-2xl font-bold">
        <AdminHomeLink />
        Destinations
      </h1>
      <DataGrid destinations={destinations} />
    </div>
  );
}
