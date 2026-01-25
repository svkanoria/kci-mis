"use client";

import { useMemo, useState } from "react";
import { ModuleRegistry } from "ag-grid-community";
import {
  AllEnterpriseModule,
  LicenseManager,
  ColDef,
  CellValueChangedEvent,
} from "ag-grid-enterprise";
import { AgGridReact } from "ag-grid-react";
import { updateRouteDistance } from "./actions";
import { getRoutes } from "@/lib/api";

// Register License Key with LicenseManager
LicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_GRID_LICENSE || "");

ModuleRegistry.registerModules([AllEnterpriseModule]);

type Route = Awaited<ReturnType<typeof getRoutes>>[number];

export const DataGrid = ({ routes }: { routes: Route[] }) => {
  const [rowData, setRowData] = useState<Route[]>(routes);

  const colDefs = useMemo<ColDef<Route>[]>(() => {
    return [
      { field: "plant", headerName: "Plant", width: 100, filter: true },
      { field: "city", headerName: "City", width: 150, filter: true },
      { field: "region", headerName: "Region", width: 150, filter: true },
      {
        field: "distanceKm",
        headerName: "Distance (Km)",
        width: 150,
        editable: true,
        valueParser: (params) => {
          return Number(params.newValue);
        },
      },
    ];
  }, []);

  const onCellValueChanged = async (event: CellValueChangedEvent<Route>) => {
    if (event.colDef.field === "distanceKm") {
      const newDistance = event.newValue;
      const id = event.data.id;
      if (typeof newDistance === "number" && !isNaN(newDistance)) {
        try {
          await updateRouteDistance(id, newDistance);
        } catch (error) {
          console.error("Failed to update distance:", error);
          // Revert change if needed, or notify user
          // For simplicity, we might just reload or show toast (not implemented here)
        }
      }
    }
  };

  return (
    <div
      className="grow min-h-0"
      style={
        {
          "--ag-spacing": "4px",
          "--ag-font-size": "12px",
        } as React.CSSProperties
      }
    >
      <AgGridReact
        rowData={rowData}
        columnDefs={colDefs}
        defaultColDef={{
          sortable: true,
          resizable: true,
        }}
        onCellValueChanged={onCellValueChanged}
      />
    </div>
  );
};
