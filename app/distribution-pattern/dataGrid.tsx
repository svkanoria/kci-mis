"use client";

import { useMemo, useState, use } from "react";
import { ModuleRegistry, SortChangedEvent } from "ag-grid-community";
import {
  AllEnterpriseModule,
  LicenseManager,
  ColDef,
  GridApi,
} from "ag-grid-enterprise";
import { AgGridReact } from "ag-grid-react";
import { getDistributionPattern } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { formatIndianNumber } from "@/lib/utils/format";

// Register License Key with LicenseManager
LicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_GRID_LICENSE || "");

ModuleRegistry.registerModules([AllEnterpriseModule]);

type ResponseType = Awaited<ReturnType<typeof getDistributionPattern>>;
type IRow = ResponseType[number];

const lsKey = (key: string) => `distribution-pattern-${key}`;
const GRID_SORT_KEY = lsKey("sort");

export const DataGrid = ({ data }: { data: Promise<ResponseType> }) => {
  const rows = use(data);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [quickFilterText, setQuickFilterText] = useState("");

  const onGridReady = (params: any) => {
    setGridApi(params.api);
    const savedSort = localStorage.getItem(GRID_SORT_KEY);
    if (savedSort) {
      params.api.applyColumnState({
        state: JSON.parse(savedSort),
        defaultState: { sort: null },
      });
    }
  };

  const onSortChanged = (params: SortChangedEvent) => {
    const sortState = params.api.getColumnState().filter((s) => s.sort != null);
    localStorage.setItem(GRID_SORT_KEY, JSON.stringify(sortState));
  };

  const defaultColDef = useMemo<ColDef>(() => {
    return {
      suppressHeaderMenuButton: true,
      wrapHeaderText: true,
    };
  }, []);

  const colDefs = useMemo<ColDef<IRow>[]>(() => {
    return [
      {
        field: "consigneeName",
        headerName: "Customer Name",
        tooltipField: "consigneeName",
        width: 300,
        filter: "agTextColumnFilter",
      },
      {
        field: "invDate",
        headerName: "Invoice Date",
        width: 150,
        filter: "agDateColumnFilter",
        sort: "desc",
        valueFormatter: (params) => {
          if (!params.value) return "";
          return new Date(params.value).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
        },
      },
      {
        field: "prevDistChannelDescription",
        headerName: "Previous Channel",
        width: 130,
        filter: "agSetColumnFilter",
      },
      {
        field: "distChannelDescription",
        headerName: "New Channel",
        width: 130,
        filter: "agSetColumnFilter",
      },
      {
        field: "avgQtyL6M",
        headerName: "Avg 6M Qty",
        width: 120,
        type: "numericColumn",
        filter: "agNumberColumnFilter",
        valueFormatter: (params) => formatIndianNumber(params.value),
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
          rowData={rows}
          columnDefs={colDefs}
          defaultColDef={defaultColDef}
          headerHeight={60}
          rowHeight={45}
          pagination
          rowGroupPanelShow="always"
          suppressAggFuncInHeader
          suppressAggFilteredOnly
          enableBrowserTooltips
          onGridReady={onGridReady}
          onSortChanged={onSortChanged}
        />
      </div>
    </div>
  );
};
