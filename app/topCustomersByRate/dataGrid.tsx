"use client";

import { use, useState } from "react";
import type { ColDef } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { getTopCustomersByRate } from "@/lib/api";

ModuleRegistry.registerModules([AllCommunityModule]);

// Row Data Interface
type IRow = Awaited<ReturnType<typeof getTopCustomersByRate>>[number];

// Create new GridExample component
export const DataGrid = ({ data }: { data: Promise<IRow[]> }) => {
  // Row Data: The data to be displayed.
  const rowData = use(data);

  // Column Definitions: Defines & controls grid columns.
  const [colDefs] = useState<ColDef<IRow>[]>([
    { field: "consigneeName", filter: true },
    { field: "rate" },
    { field: "qty" },
  ]);

  // Container: Defines the grid's theme & dimensions.
  return (
    <div className="grow min-h-0">
      <AgGridReact rowData={rowData} columnDefs={colDefs} pagination />
    </div>
  );
};
