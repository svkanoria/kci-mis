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
import { AlertTriangle, ClipboardPaste, Copy } from "lucide-react";

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
  const [quickFilterText, setQuickFilterText] = useState("");

  const handlePasteCoordinates = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parts = text.split(",");
      if (parts.length !== 2) {
        alert("Clipboard content must be in 'lat,lng' format");
        return;
      }
      const [lat, lng] = parts.map((s) => s.trim());

      if (isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
        alert("Invalid coordinates in clipboard");
        return;
      }

      const truncate = (val: string) => {
        const dotIndex = val.indexOf(".");
        if (dotIndex === -1) return val;
        return val.substring(0, dotIndex + 8);
      };

      setLatInput(truncate(lat));
      setLngInput(truncate(lng));
    } catch (error) {
      alert("Failed to read clipboard");
    }
  };

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
        cellStyle: (params) =>
          params.value === null || params.value === undefined
            ? { backgroundColor: "var(--warning)", opacity: 0.3 }
            : null,
      },
      {
        field: "lng",
        headerName: "Longitude",
        width: 150,
        cellStyle: (params) =>
          params.value === null || params.value === undefined
            ? { backgroundColor: "var(--warning)", opacity: 0.3 }
            : null,
      },
      {
        headerName: "",
        width: 120,
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
                title="Copy coordinates"
                disabled={!params.data.lat || !params.data.lng}
                onClick={() => {
                  const { lat, lng } = params.data;
                  if (lat && lng) {
                    navigator.clipboard.writeText(`${lat},${lng}`);
                  }
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-6"
                onClick={() => handleEdit(params.data)}
              >
                Edit
              </Button>
            </>
          );
        },
      },
    ];
  }, []);

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
            {destinations.filter((d) => !d.lat || !d.lng).length} coordinates
            missing
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
          getRowId={(params) => String(params.data.id)}
        />
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Coordinates</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-4 py-4">
            <div className="grid grow gap-4">
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
            <div className="w-px h-full bg-border" />
            <Button
              variant="outline"
              size="icon"
              onClick={handlePasteCoordinates}
              title="Paste lat,lng from clipboard"
            >
              <ClipboardPaste className="h-4 w-4" />
            </Button>
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
