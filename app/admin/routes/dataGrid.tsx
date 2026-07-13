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
import { updateRouteDistance, getRouteCustomers } from "./actions";
import { getRoutes } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, List } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { stringify } from "csv-stringify/sync";

// Register License Key with LicenseManager
LicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_GRID_LICENSE || "");

ModuleRegistry.registerModules([AllEnterpriseModule]);

type Route = Awaited<ReturnType<typeof getRoutes>>[number];

export const DataGrid = ({ routes }: { routes: Route[] }) => {
  const [rowData, setRowData] = useState<Route[]>(routes);
  const [quickFilterText, setQuickFilterText] = useState("");
  const [isCustomersOpen, setIsCustomersOpen] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customersList, setCustomersList] = useState<string[]>([]);
  const [dialogRouteName, setDialogRouteName] = useState("");

  const handleViewCustomers = async (route: Route) => {
    setDialogRouteName(`${route.city}, ${route.region}`);
    setLoadingCustomers(true);
    setIsCustomersOpen(true);
    try {
      const list = await getRouteCustomers(route.city, route.region);
      setCustomersList(list);
    } catch (error) {
      alert("Failed to load customers");
      setIsCustomersOpen(false);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const hasMissingDistance = (route: Route) => route.distanceKm == null;

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
    const cols: ColDef<Route>[] = [
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
            : { backgroundColor: "", opacity: 1 },
        cellRenderer: (params: any) => {
          if (
            params.value === null ||
            params.value === undefined ||
            params.value === ""
          ) {
            return <span className="italic text-xs">Double click to edit</span>;
          }
          return params.value;
        },
        valueParser: (params) => {
          return Number(params.newValue);
        },
      },
      {
        headerName: "",
        width: 60,
        filter: false,
        sortable: false,
        resizable: false,
        suppressHeaderMenuButton: true,
        suppressNavigable: true,
        cellStyle: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        },
        cellRenderer: (params: any) => {
          if (!params.data) return null;
          return (
            <>
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6"
                title="View customers"
                onClick={() => handleViewCustomers(params.data)}
              >
                <List className="h-3 w-3" />
              </Button>
            </>
          );
        },
      },
    ];
    return cols;
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
            {rowData.filter(hasMissingDistance).length} distances missing
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

      <Dialog open={isCustomersOpen} onOpenChange={setIsCustomersOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Customers in {dialogRouteName}</DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-[300px] overflow-y-auto">
            {loadingCustomers ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                Loading customers...
              </div>
            ) : customersList.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                No customers found.
              </div>
            ) : (
              <ul className="list-disc pl-5 space-y-1.5 text-sm">
                {customersList.map((customer, idx) => (
                  <li key={idx} className="font-medium text-foreground">
                    {customer}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsCustomersOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
