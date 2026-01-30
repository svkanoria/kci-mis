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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { stringify } from "csv-stringify/sync";

// Register License Key with LicenseManager
LicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_GRID_LICENSE || "");

ModuleRegistry.registerModules([AllEnterpriseModule]);

type Route = Awaited<ReturnType<typeof getRoutes>>[number];

export const DataGrid = ({ routes }: { routes: Route[] }) => {
  const [rowData, setRowData] = useState<Route[]>(routes);
  const [quickFilterText, setQuickFilterText] = useState("");

  const handleCopyCsv = () => {
    const data = rowData.map((row) => ({
      plant: row.plant,
      city: row.city,
      region: row.region,
      distanceKm: row.distanceKm,
      isEstimated: row.isEstimated,
    }));

    const csvContent = stringify(data, {
      header: true,
      columns: ["plant", "city", "region", "distanceKm", "isEstimated"],
    });

    navigator.clipboard.writeText(csvContent);
    alert("Copied to clipboard!");
  };

  const colDefs = useMemo<ColDef<Route>[]>(() => {
    return [
      { field: "plant", headerName: "From Plant", width: 150, filter: true },
      { field: "city", headerName: " To City", width: 150, filter: true },
      { field: "region", headerName: "Region", width: 150, filter: true },
      {
        field: "distanceKm",
        headerName: "Distance (Km)",
        width: 150,
        editable: true,
        cellStyle: (params) =>
          params.value === null || params.value === undefined
            ? { backgroundColor: "var(--warning)", opacity: 0.3 }
            : null,
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
          event.node.setDataValue("distanceKm", event.oldValue);
          alert("Failed to update distance");
        }
      }
    }
  };

  return (
    <div className="grow min-h-0 flex flex-col gap-2">
      <div className="flex justify-between items-center gap-4">
        <div className="w-72">
          <Input
            placeholder="Quick search..."
            value={quickFilterText}
            onChange={(e) => setQuickFilterText(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-warning flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {
              routes.filter(
                (r) => r.distanceKm === null || r.distanceKm === undefined,
              ).length
            }{" "}
            distances missing
          </div>
          <Button onClick={handleCopyCsv}>Copy as CSV</Button>
        </div>
      </div>
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
          quickFilterText={quickFilterText}
          rowData={rowData}
          columnDefs={colDefs}
          defaultColDef={{
            sortable: true,
            resizable: true,
          }}
          rowHeight={40}
          onCellValueChanged={onCellValueChanged}
        />
      </div>
    </div>
  );
};
