"use client";

import { use, useState } from "react";

import type { ColDef } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { getQtyByConsigneeAndPeriod } from "@/lib/api";
import { formatIndianNumber } from "@/lib/utils/format";

ModuleRegistry.registerModules([AllCommunityModule]);

type IRow = Awaited<ReturnType<typeof getQtyByConsigneeAndPeriod>>[number];

export const DataGrid = ({ data }: { data: Promise<IRow[]> }) => {
  const rowData = use(data);

  const [colDefs] = useState<ColDef<IRow>[]>([
    { field: "consigneeName", filter: true, flex: 1 },
    {
      field: "period",
      filter: true,
      valueFormatter: (params) => {
        if (!params.value) return "";
        const date = new Date(params.value as string | Date);
        return date.toLocaleDateString();
      },
    },
    {
      field: "qty",
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
