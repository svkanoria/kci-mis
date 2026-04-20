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
import { getLostCustomers } from "@/lib/api";
import { formatIndianNumber } from "@/lib/utils/format";
import { Input } from "@/components/ui/input";
import { TimeDirectionButton } from "@/app/_components/timeDirectionButton";
import { useTimeDirectionStore } from "@/lib/store";
import { ConsigneeNameCellRenderer } from "../_utils/cellRenderers";
import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Register License Key with LicenseManager
LicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_GRID_LICENSE || "");

ModuleRegistry.registerModules([AllEnterpriseModule]);

type ResponseType = Awaited<ReturnType<typeof getLostCustomers>>;
type IRow = ResponseType[number];

const lsKey = (key: string) => `lost-customers-fd-${key}`;
const GRID_SORT_KEY = lsKey("sort");

const BarSparklineCellRenderer = (params: any) => {
  if (!params.value) return null;
  const { trend, isFlipped } = params.value;

  if (!trend || trend.length < 1) return null;

  const width = 300;
  const graphWidth = 260;
  const height = 37;
  const padding = 3;
  const barGap = 2;

  const max = Math.max(...trend, 0);
  const min = Math.min(...trend, 0);
  const range = max - min || 1;

  const totalBars = trend.length;
  const barWidth = Math.max(
    1,
    (graphWidth - 2 * padding - (totalBars - 1) * barGap) / totalBars,
  );

  const zeroY = height - padding - ((0 - min) / range) * (height - 2 * padding);

  const bars = trend.map((val: number, i: number) => {
    const x = isFlipped
      ? graphWidth - padding - barWidth - i * (barWidth + barGap)
      : padding + i * (barWidth + barGap);

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
        className="overflow-visible"
      >
        {bars}
        <text
          x={graphWidth + 4}
          y={8}
          fontSize="9"
          fill="#6b7280"
          textAnchor="start"
        >
          {formatIndianNumber(max)}
        </text>
        <text
          x={graphWidth + 4}
          y={height - 2}
          fontSize="9"
          fill="#6b7280"
          textAnchor="start"
        >
          {formatIndianNumber(min)}
        </text>
      </svg>
    </div>
  );
};

const ChannelsCellRenderer = (params: any) => {
  const value = params.value;
  if (!value) return null;

  const items: string[] = Object.keys(value).sort((a, b) => {
    const dateA = new Date(value[a]?.lastInvDate ?? 0).getTime();
    const dateB = new Date(value[b]?.lastInvDate ?? 0).getTime();
    return dateB - dateA;
  });

  if (items.length === 0) return null;

  const getBadgeClass = (item: string) => {
    switch (item) {
      case "Direct":
        return "bg-green-100 text-green-800";
      case "Agent":
        return "bg-blue-100 text-blue-800";
      case "Dealer":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="flex justify-between items-center h-full w-full pr-1">
      <div className="flex items-center gap-1 overflow-hidden">
        {items.map((item, index) => (
          <span
            key={index}
            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${getBadgeClass(
              item,
            )}`}
          >
            {item}
          </span>
        ))}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <div
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
            onClick={(e) => e.stopPropagation()}
            title="Channel Details"
          >
            <Info className="h-3.5 w-3.5" />
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-3"
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-2">
            <h4 className="font-medium text-sm border-b pb-1">
              Channel Details
            </h4>
            <div className="grid gap-2">
              {items.map((item) => {
                const data = value[item];
                if (!data) return null;
                return (
                  <div
                    key={item}
                    className="flex justify-between items-center gap-6 text-sm border-b border-border/50 last:border-0 pb-1.5 last:pb-0"
                  >
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getBadgeClass(item)}`}
                    >
                      {item}
                    </span>
                    <div className="text-right">
                      <div className="font-medium text-xs">
                        {formatIndianNumber(data.qty)} MT
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(data.lastInvDate).toLocaleDateString(
                          "en-IN",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export const DataGrid = ({ data }: { data: Promise<ResponseType> }) => {
  const rows = use(data);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [quickFilterText, setQuickFilterText] = useState("");
  const { isTimeFlipped, toggleTimeFlipped } = useTimeDirectionStore();

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
        cellRenderer: ConsigneeNameCellRenderer,
      },
      {
        field: "channels",
        headerName: "Channels",
        width: 200,
        filter: "agSetColumnFilter",
        cellRenderer: ChannelsCellRenderer,
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
        width: 320,
        filter: false,
        sortable: false,
        valueGetter: (params) => {
          if (!params.data || !params.data.history) return null;
          const trend = params.data.history.map((h) => h.qty);
          return { trend, isFlipped: isTimeFlipped };
        },
        cellRenderer: BarSparklineCellRenderer,
      },
    ];
  }, [isTimeFlipped]);

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
        <div>
          <TimeDirectionButton />
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
          rowHeight={47}
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
