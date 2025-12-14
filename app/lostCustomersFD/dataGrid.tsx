"use client";

import { useMemo, useState } from "react";
import { ModuleRegistry } from "ag-grid-community";
import {
  AllEnterpriseModule,
  LicenseManager,
  ColDef,
} from "ag-grid-enterprise";
import { AgGridReact } from "ag-grid-react";
import { getLostCustomers } from "@/lib/api";
import { formatIndianNumber } from "@/lib/utils/format";
import { Input } from "@/components/ui/input";

// Register License Key with LicenseManager
LicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_GRID_LICENSE || "");

ModuleRegistry.registerModules([AllEnterpriseModule]);

type IRow = Awaited<ReturnType<typeof getLostCustomers>>[number];

const BarSparklineCellRenderer = (params: any) => {
  if (!params.value) return null;
  const { trend } = params.value;

  if (!trend || trend.length < 1) return null;

  const width = 140;
  const height = 37;
  const padding = 3;
  const barGap = 2;

  const max = Math.max(...trend, 0);
  const min = Math.min(...trend, 0);
  const range = max - min || 1;

  const totalBars = trend.length;
  const barWidth = Math.max(
    1,
    (width - 2 * padding - (totalBars - 1) * barGap) / totalBars,
  );

  const zeroY = height - padding - ((0 - min) / range) * (height - 2 * padding);

  const bars = trend.map((val: number, i: number) => {
    const x = padding + i * (barWidth + barGap);

    if (val === 0) {
      return (
        <rect
          key={i}
          x={x}
          y={zeroY - 1}
          width={barWidth}
          height={2}
          fill="#ef4444"
          opacity="0.8"
        />
      );
    }

    const valY =
      height - padding - ((val - min) / range) * (height - 2 * padding);

    const barHeight = Math.abs(zeroY - valY);
    const y = Math.min(zeroY, valY);

    const fill = val > 0 ? "#2563eb" : "#ef4444";

    return (
      <rect
        key={i}
        x={x}
        y={y}
        width={barWidth}
        height={barHeight}
        fill={fill}
        opacity="0.8"
      />
    );
  });

  return (
    <div className="flex items-center justify-center h-full w-full overflow-hidden">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        {bars}
      </svg>
    </div>
  );
};

export const DataGrid = ({ data }: { data: IRow[] }) => {
  const [gridApi, setGridApi] = useState<any>(null);
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
        field: "status",
        headerName: "Status",
        tooltipField: "status",
        width: 130,
        hide: true,
        filter: "agSetColumnFilter",
        sort: "desc",
        rowGroup: true,
        enableRowGroup: true,
        valueFormatter: (params) => {
          if (params.value === 0) return "Current";
          return `Lost ${params.value}+ months`;
        },
        cellClassRules: {
          "text-red-600 font-medium": (params) => params.value > 0,
          "text-green-600 font-medium": (params) => params.value === 0,
        },
      },
      {
        field: "consigneeName",
        headerName: "Customer Name",
        tooltipField: "consigneeName",
        width: 300,
        filter: "agTextColumnFilter",
      },
      {
        field: "lastInvDate",
        headerName: "Last Inv Date",
        width: 120,
        filter: "agDateColumnFilter",
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
        field: "qty",
        headerName: "Total Qty",
        width: 110,
        type: "numericColumn",
        filter: "agNumberColumnFilter",
        sort: "desc",
        valueFormatter: (params) => formatIndianNumber(params.value),
      },
      {
        field: "avgActiveMonthQty",
        headerName: "Avg NZ Qty",
        width: 110,
        type: "numericColumn",
        filter: "agNumberColumnFilter",
        valueFormatter: (params) => formatIndianNumber(params.value),
      },
      {
        field: "history",
        headerName: "History",
        flex: 1,
        filter: false,
        sortable: false,
        valueGetter: (params) => {
          if (!params.data || !params.data.history) return null;
          const trend = params.data.history.map((h) => h.qty);
          return { trend };
        },
        cellRenderer: BarSparklineCellRenderer,
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
          rowData={data}
          columnDefs={colDefs}
          defaultColDef={defaultColDef}
          headerHeight={60}
          rowHeight={40}
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
