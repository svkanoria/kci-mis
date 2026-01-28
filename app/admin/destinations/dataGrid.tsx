"use client";

import { useMemo, useState } from "react";
import { ModuleRegistry } from "ag-grid-community";
import {
  AllEnterpriseModule,
  LicenseManager,
  ColDef,
} from "ag-grid-enterprise";
import { AgGridReact } from "ag-grid-react";
import { updateDestinationCoordinates } from "./actions";
import { getDestinations } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { stringify } from "csv-stringify/sync";

// Register License Key with LicenseManager
LicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_GRID_LICENSE || "");

ModuleRegistry.registerModules([AllEnterpriseModule]);

type Destination = Awaited<ReturnType<typeof getDestinations>>[number];

export const DataGrid = ({ destinations }: { destinations: Destination[] }) => {
  const [rowData, setRowData] = useState<Destination[]>(destinations);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDestination, setEditingDestination] =
    useState<Destination | null>(null);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");

  const handleEdit = (destination: Destination) => {
    setEditingDestination(destination);
    setLatInput(destination.lat?.toString() || "");
    setLngInput(destination.lng?.toString() || "");
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingDestination) return;

    if (latInput === "" && lngInput === "") {
      try {
        await updateDestinationCoordinates(editingDestination.id, null, null);
        setRowData((prev) =>
          prev.map((d) =>
            d.id === editingDestination.id ? { ...d, lat: null, lng: null } : d,
          ),
        );
        setIsDialogOpen(false);
      } catch (error) {
        alert("Failed to update coordinates");
      }
      return;
    }

    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);

    if (isNaN(lat) || isNaN(lng)) {
      return;
    }

    try {
      await updateDestinationCoordinates(editingDestination.id, lat, lng);
      setRowData((prev) =>
        prev.map((d) =>
          d.id === editingDestination.id ? { ...d, lat, lng } : d,
        ),
      );
      setIsDialogOpen(false);
    } catch (error) {
      alert("Failed to update coordinates");
    }
  };

  const handleCopyCsv = () => {
    const data = rowData.map((row) => ({
      city: row.city,
      region: row.region,
      latitude: row.lat,
      longitude: row.lng,
    }));

    const csvContent = stringify(data, {
      header: true,
      columns: ["city", "region", "latitude", "longitude"],
    });

    navigator.clipboard.writeText(csvContent);
    alert("Copied to clipboard!");
  };

  const colDefs = useMemo<ColDef<Destination>[]>(() => {
    return [
      { field: "city", headerName: "City", width: 150, filter: true },
      { field: "region", headerName: "Region", width: 150, filter: true },
      {
        field: "lat",
        headerName: "Latitude",
        width: 150,
      },
      {
        field: "lng",
        headerName: "Longitude",
        width: 150,
      },
      {
        headerName: "",
        width: 100,
        filter: false,
        sortable: false,
        resizable: false,
        suppressHeaderMenuButton: true,
        suppressNavigable: true,
        cellStyle: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
        cellRenderer: (params: any) => {
          if (!params.data) return null;
          return (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-6"
              onClick={() => handleEdit(params.data)}
            >
              Edit
            </Button>
          );
        },
      },
    ];
  }, []);

  return (
    <div className="grow min-h-0 flex flex-col gap-2">
      <div className="flex justify-end">
        <Button onClick={handleCopyCsv}>Copy as CSV</Button>
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
          rowData={rowData}
          columnDefs={colDefs}
          defaultColDef={{
            sortable: true,
            resizable: true,
          }}
          rowHeight={40}
        />
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Coordinates</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lat" className="text-right">
                Latitude
              </Label>
              <Input
                id="lat"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                className="col-span-3"
                type="number"
                step="any"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lng" className="text-right">
                Longitude
              </Label>
              <Input
                id="lng"
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                className="col-span-3"
                type="number"
                step="any"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
