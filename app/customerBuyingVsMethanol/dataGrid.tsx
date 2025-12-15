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
import { getCustomerBuyingVsMethanol } from "@/lib/api";
import { formatIndianNumber } from "@/lib/utils/format";
import { Input } from "@/components/ui/input";

// Register License Key with LicenseManager
LicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_GRID_LICENSE || "");

ModuleRegistry.registerModules([AllEnterpriseModule]);

type IRow = Awaited<ReturnType<typeof getCustomerBuyingVsMethanol>>[number];

const BarSparklineCellRenderer = (params: any) => {
  if (!params.value) return null;
  const { data } = params.value;

  if (!data || data.length < 1) return null;

  const width = 300;
  const height = 50;
  const padding = 3;
  const barGap = 0.2;

  const gains = data.map((d: any) => d.gain);
  const max = Math.max(...gains, 0);
  const min = Math.min(...gains, 0);
  const range = max - min || 1;
  const barWidth = 0.8;

  const zeroY = height - padding - ((0 - min) / range) * (height - 2 * padding);

  const contractLines = data.map((d: any, i: number) => {
    if (!d.contractedQty) return null;
    const x = padding + i * (barWidth + barGap);
    return (
      <line
        key={`line-${i}`}
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke="green"
        strokeWidth="0.2"
        opacity="0.8"
      />
    );
  });

  const bars = data.map((d: any, i: number) => {
    const val = d.gain;
    const x = padding + i * (barWidth + barGap);

    const valY =
      height - padding - ((val - min) / range) * (height - 2 * padding);

    const barHeight = Math.abs(zeroY - valY);
    const y = Math.min(zeroY, valY);

    const fill = val >= 0 ? "#2563eb" : "#ef4444";

    return (
      <rect
        key={i}
        x={x}
        y={y}
        width={barWidth}
        height={barHeight}
        fill={fill}
        opacity="0.8"
      >
        <title>{`${d.date}: ${formatIndianNumber(val)}`}</title>
      </rect>
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
        {contractLines}
        {bars}
        <line
          x1={padding}
          y1={zeroY}
          x2={width - padding}
          y2={zeroY}
          stroke="#666"
          strokeWidth="0.5"
          opacity="0.5"
        />
      </svg>
    </div>
  );
};

export const DataGrid = ({ data }: { data: Promise<IRow[]> }) => {
  const rows = use(data);
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
        field: "consigneeName",
        headerName: "Customer",
        width: 250,
        filter: true,
        pinned: "left",
      },
      {
        field: "buyingVsMethanol",
        headerName: "Gain vs Methanol (Daily)",
        flex: 1,
        cellRenderer: BarSparklineCellRenderer,
        valueGetter: (params) => {
          return { data: params.data?.buyingVsMethanol };
        },
      },
      {
        field: "totalGain",
        headerName: "Gain",
        width: 110,
        valueFormatter: (params) => formatIndianNumber(params.value),
        type: "numericColumn",
        sort: "desc",
        aggFunc: "sum",
      },
      {
        field: "totalContractedQty",
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
          const totalGain = params.getValue("totalGain") ?? 0;
          const totalQty = params.getValue("totalContractedQty") ?? 0;
          if (totalQty === 0) return 0;
          return totalGain / totalQty;
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
          headerHeight={40}
          rowHeight={70}
          grandTotalRow="top"
          pagination
          suppressAggFuncInHeader
          suppressAggFilteredOnly
          enableBrowserTooltips
          onGridReady={(params) => setGridApi(params.api)}
        />
      </div>
    </div>
  );
};
