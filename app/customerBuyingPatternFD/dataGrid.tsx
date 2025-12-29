"use client";

import { use, useMemo, useState } from "react";
import { ModuleRegistry, SortChangedEvent } from "ag-grid-community";
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

type ResponseType = Awaited<ReturnType<typeof getCustomerBuyingPatternFD>>;
type IRow = ResponseType["data"][number];

const lsKey = (key: string) => `customerBuyingPatternFD-${key}`;
const GRID_SORT_KEY = lsKey("sort");

export const DataGrid = ({
  queryResult,
}: {
  queryResult: Promise<ResponseType>;
}) => {
  const { data, methanolPrices } = use(queryResult);
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

  const autoGroupColumnDef = useMemo<ColDef>(() => {
    return {
      width: 250,
      pinned: "left",
    };
  }, []);

  const colDefs = useMemo<ColDef<IRow>[]>(() => {
    return [
      {
        headerName: "Year",
        width: 90,
        hide: true,
        rowGroup: true,
        rowGroupIndex: 0,
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
        rowGroupIndex: 1,
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
      {
        headerName: "Timeline",
        width: 210,
        sortable: false,
        cellRenderer: (params: any) => {
          if (params.node.group) return null;

          const contractDate = params.data.contractDate;
          const finalLiftingDate = params.data.finalLiftingDate;

          if (!contractDate || !finalLiftingDate) return null;

          const startIndex = methanolPrices.findIndex(
            (p) => p.date >= contractDate,
          );
          if (startIndex === -1) return null;

          const relevantPrices = [];
          const loopStart = Math.max(0, startIndex - 15);
          for (let i = loopStart; i < methanolPrices.length; i++) {
            const p = methanolPrices[i];
            if (p.date > finalLiftingDate) break;
            relevantPrices.push(p.price);
          }

          if (relevantPrices.length === 0) return null;

          const minPrice = Math.min(...relevantPrices);
          const maxPrice = Math.max(...relevantPrices);
          const range = maxPrice - minPrice || 1;

          const width = 150;
          const height = 40;

          const contractPrice = params.data.contractMethanolPrice;
          const contractPriceY =
            height - ((contractPrice - minPrice) / range) * height;

          const contractIndex = startIndex - loopStart;
          const contractX =
            (contractIndex / (relevantPrices.length - 1 || 1)) * width;

          const points = relevantPrices
            .map((price, index) => {
              const x = (index / (relevantPrices.length - 1 || 1)) * width;
              const y = height - ((price - minPrice) / range) * height;
              return `${x},${y}`;
            })
            .join(" ");

          const invoices = params.data.invoices || [];
          let maxAbsGain = 0;
          for (const inv of invoices) {
            if (Math.abs(inv.gain) > maxAbsGain)
              maxAbsGain = Math.abs(inv.gain);
          }

          const bars = [];
          let priceCursor = startIndex;

          for (const invoice of invoices) {
            while (
              priceCursor < methanolPrices.length &&
              methanolPrices[priceCursor].date < invoice.date
            ) {
              priceCursor++;
            }

            if (
              priceCursor < methanolPrices.length &&
              methanolPrices[priceCursor].date === invoice.date
            ) {
              const relativeIndex = priceCursor - loopStart;
              if (relativeIndex < relevantPrices.length) {
                const x =
                  (relativeIndex / (relevantPrices.length - 1 || 1)) * width;

                const zeroY = height / 2;
                const barHeight =
                  maxAbsGain === 0
                    ? 0
                    : (Math.abs(invoice.gain) / maxAbsGain) * (height / 2);

                const y = invoice.gain > 0 ? zeroY - barHeight : zeroY;
                const color = invoice.gain >= 0 ? "#22c55e" : "#ef4444";

                bars.push(
                  <rect
                    key={invoice.date}
                    x={x}
                    y={y}
                    width={2}
                    height={barHeight}
                    fill={color}
                    opacity={0.8}
                  />,
                );
              }
            }
          }

          return (
            <div className="flex items-center h-full">
              <svg
                width={width}
                height={height}
                style={{ overflow: "visible" }}
              >
                <line
                  x1={contractX}
                  y1={0}
                  x2={contractX}
                  y2={height}
                  stroke="purple"
                  strokeWidth="1"
                />
                <line
                  x1={0}
                  y1={contractPriceY}
                  x2={width}
                  y2={contractPriceY}
                  stroke="#9ca3af"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                {bars}
                <polyline
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="1.5"
                  points={points}
                />
                <text
                  x={width + 6}
                  y={8}
                  fontSize="9"
                  fill="#6b7280"
                  textAnchor="start"
                >
                  {maxPrice.toFixed(2)}
                </text>
                <text
                  x={width + 6}
                  y={height}
                  fontSize="9"
                  fill="#6b7280"
                  textAnchor="start"
                >
                  {minPrice.toFixed(2)}
                </text>
              </svg>
            </div>
          );
        },
      },
    ];
  }, [methanolPrices]);

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
          autoGroupColumnDef={autoGroupColumnDef}
          headerHeight={40}
          rowHeight={50}
          grandTotalRow="top"
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
