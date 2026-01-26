import { getRoutes } from "@/lib/api";
import { DataGrid } from "./dataGrid";
import { HeaderTitleUpdater } from "../../_components/headerTitleUpdater";

export const dynamic = "force-dynamic";

export default async function Page() {
  const routes = await getRoutes();

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <HeaderTitleUpdater title="Route Management" />
      <h1 className="text-2xl font-bold">Routes</h1>
      <DataGrid routes={routes} />
    </div>
  );
}
