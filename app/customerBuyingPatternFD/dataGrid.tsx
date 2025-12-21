"use client";

import { use, useMemo, useState } from "react";
import { ModuleRegistry } from "ag-grid-community";
import {
  AllEnterpriseModule,
  LicenseManager,
  ColDef,
  GridApi,
} from "ag-grid-enterprise";
import { AgGridReact } from "ag-grid-react";
import { getCustomerBuyingPatternFD } from "@/lib/api";
import { formatIndianNumber } from "@/lib/utils/format";
import { Input } from "@/components/ui/input";
import { differenceInDays } from "date-fns";
import { getStartOfFY, parseDate } from "@/lib/utils/date";

// Register License Key with LicenseManager
LicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_GRID_LICENSE || "");

ModuleRegistry.registerModules([AllEnterpriseModule]);

type IRow = Awaited<ReturnType<typeof getCustomerBuyingPatternFD>>[number];

export const DataGrid = ({ data }: { data: Promise<IRow[]> }) => {
  const rowData = use(data);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [quickFilterText, setQuickFilterText] = useState("");

  const defaultColDef = useMemo<ColDef>(() => {
    return {
      suppressHeaderMenuButton: true,
      wrapHeaderText: true,
    };
  }, []);

  const colDefs = useMemo<ColDef<IRow>[]>(() => {
    return [
      {
        headerName: "Year",
        width: 90,
        hide: true,
        rowGroup: true,
        enableRowGroup: true,
        pinned: "left",
        valueFormatter: (params) => {
          const date = params.value;
          if (!date) return "";
          return date.toLocaleDateString(undefined, {
            year: "2-digit",
            month: "short",
          });
        },
        type: "dateColumn",
        valueGetter: (params) => {
          const finalLiftingDate = params.getValue("finalLiftingDate");
          if (!finalLiftingDate) return "";
          return getStartOfFY(parseDate(finalLiftingDate as string));
        },
      },
      {
        field: "consigneeName",
        headerName: "Consignee Name",
        width: 250,
        hide: true,
        filter: true,
        rowGroup: true,
        enableRowGroup: true,
        pinned: "left",
      },
      {
        field: "contractDate",
        headerName: "Contract Date",
        width: 120,
        sort: "desc",
      },
      {
        field: "gain",
        headerName: "Customer Gain",
        width: 110,
        sort: "desc",
        valueFormatter: (params) => formatIndianNumber(params.value),
        type: "numericColumn",
        aggFunc: "sum",
      },
      {
        field: "contractQty",
        headerName: "Qty",
        width: 90,
        valueFormatter: (params) => formatIndianNumber(params.value),
        type: "numericColumn",
        aggFunc: "sum",
      },
      {
        headerName: "Gain/MT",
        width: 90,
        valueFormatter: (params) => formatIndianNumber(params.value),
        type: "numericColumn",
        valueGetter: (params) => {
          const totalGain = params.getValue("gain") ?? 0;
          const totalQty = params.getValue("contractQty") ?? 0;
          if (totalQty === 0) return 0;
          return totalGain / totalQty;
        },
      },
      {
        field: "firstLiftingDate",
        headerName: "First Lifting Date",
        width: 120,
        hide: true,
        sortable: false,
      },
      {
        field: "finalLiftingDate",
        headerName: "Final Lifting Date",
        width: 120,
        hide: true,
        sortable: false,
      },
      {
        headerName: "Days Till 1st Lifting",
        width: 110,
        valueFormatter: (params) => formatIndianNumber(params.value),
        type: "numericColumn",
        valueGetter: (params) => {
          const firstLiftingDate = params.getValue("firstLiftingDate");
          const contractDate = params.getValue("contractDate");
          if (!firstLiftingDate || !contractDate) return null;
          return differenceInDays(
            parseDate(firstLiftingDate as string),
            parseDate(contractDate as string),
          );
        },
        aggFunc: "avg",
      },
      {
        headerName: "Days Till Last Lifting",
        width: 110,
        valueFormatter: (params) => formatIndianNumber(params.value),
        type: "numericColumn",
        valueGetter: (params) => {
          const finalLiftingDate = params.getValue("finalLiftingDate");
          const contractDate = params.getValue("contractDate");
          if (!finalLiftingDate || !contractDate) return null;
          return differenceInDays(
            parseDate(finalLiftingDate as string),
            parseDate(contractDate as string),
          );
        },
        aggFunc: "avg",
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
          rowData={rowData}
          columnDefs={colDefs}
          defaultColDef={defaultColDef}
          headerHeight={40}
          rowHeight={30}
          grandTotalRow="top"
          pagination
          rowGroupPanelShow="always"
          suppressAggFuncInHeader
          suppressAggFilteredOnly
          enableBrowserTooltips
          onGridReady={(params) => setGridApi(params.api)}
        />
      </div>
    </div>
  );
};
