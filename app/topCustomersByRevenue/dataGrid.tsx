"use client";

import { use, useState } from "react";

import type { ColDef } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { getTopCustomersByRevenue } from "@/lib/api";
import { formatIndianNumber } from "@/lib/utils/format";

ModuleRegistry.registerModules([AllCommunityModule]);

type IRow = Awaited<ReturnType<typeof getTopCustomersByRevenue>>[number];

export const DataGrid = ({ data }: { data: Promise<IRow[]> }) => {
  const rowData = use(data);

  const [colDefs] = useState<ColDef<IRow>[]>([
    { field: "consigneeName", filter: true, flex: 1 },
    {
      field: "revenue",
      type: "numericColumn",
      sort: "desc",
      valueFormatter: (params) => formatIndianNumber(params.value),
    },
  ]);

  return (
    <div className="grow min-h-0">
      <AgGridReact rowData={rowData} columnDefs={colDefs} pagination />
    </div>
  );
};
