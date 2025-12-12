"use client";

import { use, useMemo, useState, useEffect, useId } from "react";

import { ModuleRegistry } from "ag-grid-community";
import {
  AllEnterpriseModule,
  LicenseManager,
  ColDef,
  GridApi,
} from "ag-grid-enterprise";
import { AgGridReact } from "ag-grid-react";
import { getTopCustomers } from "@/lib/api";
import { formatIndianNumber } from "@/lib/utils/format";
import Select from "react-select";
import { calculateRegression } from "@/lib/utils/stats";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

// Register License Key with LicenseManager
LicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_GRID_LICENSE || "");

ModuleRegistry.registerModules([AllEnterpriseModule]);

type IRow = Awaited<ReturnType<typeof getTopCustomers>>[number];

const SparklineCellRenderer = (params: any) => {
  if (!params.value) return null;
  const { trend, avg, slope, intercept, isFlipped } = params.value;

  if (!trend || trend.length < 2) return null;

  const width = 140;
  const height = 37;
  const padding = 3;

  let regValues: number[] = [];
  if (typeof slope === "number" && typeof intercept === "number") {
    const y1 = intercept;
    const y2 = slope * (trend.length - 1) + intercept;
    regValues = [y1, y2];
  }

  const max = Math.max(...trend, avg ?? 0, ...regValues);
  const min = Math.min(...trend, avg ?? 0, ...regValues);
  const range = max - min || 1;

  const getX = (i: number, total: number) => {
    const ratio = i / (total - 1);
    const effectiveRatio = isFlipped ? 1 - ratio : ratio;
    return effectiveRatio * (width - 2 * padding) + padding;
  };

  const points = trend
    .map((val: number, i: number) => {
      const x = getX(i, trend.length);
      const y =
        height - padding - ((val - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    })
    .join(" ");

  const zeroPoints = trend
    .map((val: number, i: number) => {
      if (val !== 0) return null;
      const x = getX(i, trend.length);
      const y =
        height - padding - ((val - min) / range) * (height - 2 * padding);
      return { x, y };
    })
    .filter((p: any) => p !== null);

  const avgY =
    height - padding - ((avg - min) / range) * (height - 2 * padding);

  let regLine = null;
  if (typeof slope === "number" && typeof intercept === "number") {
    const y1Val = intercept;
    const y2Val = slope * (trend.length - 1) + intercept;

    const x1 = isFlipped ? width - padding : padding;
    const x2 = isFlipped ? padding : width - padding;

    const y1 =
      height - padding - ((y1Val - min) / range) * (height - 2 * padding);
    const y2 =
      height - padding - ((y2Val - min) / range) * (height - 2 * padding);

    regLine = (
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#10b981"
        strokeWidth="1"
        opacity="0.5"
      />
    );
  }

  return (
    <div className="flex items-center justify-center h-full w-full overflow-hidden">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <polyline
          points={points}
          fill="none"
          stroke="#2563eb"
          strokeWidth="1.5"
        />
        {regLine}
        {zeroPoints.map((p: any, i: number) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill="#ef4444" />
        ))}
        <line
          x1={padding}
          y1={avgY}
          x2={width - padding}
          y2={avgY}
          stroke="#ef4444"
          strokeWidth="1"
          strokeDasharray="4 2"
          opacity="0.7"
        />
      </svg>
    </div>
  );
};

const lsKey = (key: string) => `topCustomersFD-${key}`;
const SHOW_STATS_KEY = lsKey("showStats");
const SELECTED_GROUPS_KEY = lsKey("selectedGroups");
const IS_TIME_FLIPPED_KEY = lsKey("isTimeFlipped");

interface GridRow {
  consigneeName: string | null;
  [key: string]: any;
}

export const DataGrid = ({
  data,
  initialGrouping,
}: {
  data: Promise<IRow[]>;
  initialGrouping?: string;
}) => {
  const groupedData = use(data);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [isTimeFlipped, setIsTimeFlipped] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const storedShowStats = localStorage.getItem(SHOW_STATS_KEY);
    if (storedShowStats !== null) {
      setShowStats(storedShowStats === "true");
    }

    const storedIsTimeFlipped = localStorage.getItem(IS_TIME_FLIPPED_KEY);
    if (storedIsTimeFlipped !== null) {
      setIsTimeFlipped(storedIsTimeFlipped === "true");
    }

    const storedSelectedGroups = localStorage.getItem(SELECTED_GROUPS_KEY);
    if (storedSelectedGroups) {
      try {
        setSelectedGroups(JSON.parse(storedSelectedGroups));
      } catch (e) {
        console.error("Failed to parse stored selected groups", e);
      }
    } else {
      setSelectedGroups(["qty", "rate"]);
    }

    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(SHOW_STATS_KEY, String(showStats));
      localStorage.setItem(IS_TIME_FLIPPED_KEY, String(isTimeFlipped));
      localStorage.setItem(SELECTED_GROUPS_KEY, JSON.stringify(selectedGroups));
    }
  }, [showStats, isTimeFlipped, selectedGroups, isInitialized]);

  const instanceId = useId();

  const options = [
    { value: "qty", label: "Qty" },
    { value: "rate", label: "Rate" },
    { value: "delta", label: "Delta" },
  ];

  const periods = useMemo(() => {
    const allPeriods = new Set<string>();
    groupedData.forEach((group) => {
      group.series.forEach(({ periodStart }) => {
        const p = periodStart.getTime().toString();
        allPeriods.add(p);
      });
    });
    return Array.from(allPeriods).sort((a, b) => parseInt(a) - parseInt(b));
  }, [groupedData]);

  const defaultColDef = useMemo<ColDef>(() => {
    return {
      suppressHeaderMenuButton: true,
      wrapHeaderText: true,
    };
  }, []);

  const autoGroupColumnDef = useMemo<ColDef>(() => {
    return {
      width: 220,
      pinned: "left",
      tooltipValueGetter: (params: any) => {
        if (params.node.group) {
          return `Group: ${params.value}`;
        }
        return "";
      },
    };
  }, []);

  const rowData = useMemo<GridRow[]>(() => {
    return groupedData.map(({ series, ...rest }) => {
      const row: GridRow = {
        ...rest,
      };
      series.forEach(({ periodStart, value: { qty, amount, rate, delta } }) => {
        const p = periodStart.getTime().toString();
        row[p] = qty;
        row[p + "-amount"] = amount;
        row[p + "-rate"] = rate;
        row[p + "-delta-amount"] = (delta ?? 0) * qty;
        row[p + "-delta"] = delta;
      });
      return row;
    });
  }, [groupedData]);

  const colDefs = useMemo<ColDef<GridRow>[]>(() => {
    const showQty = selectedGroups.includes("qty");
    const showRate = selectedGroups.includes("rate");
    const showDelta = selectedGroups.includes("delta");

    const qtyStyle = { backgroundColor: "rgba(255, 235, 205, 0.3)" };
    const rateStyle = { backgroundColor: "rgba(240, 200, 255, 0.3)" };
    const deltaStyle = { backgroundColor: "rgba(200, 255, 200, 0.3)" };

    const defs: ColDef<GridRow>[] = [
      {
        field: "plant",
        width: 70,
        pinned: "left",
        filter: true,
        sortable: false,
        enableRowGroup: true,
        hide: true,
      },
      {
        field: "distChannelDescription",
        headerName: "Dist. Channel",
        width: 150,
        pinned: "left",
        filter: true,
        enableRowGroup: true,
        hide: true,
      },
      {
        field: "recipientName",
        tooltipField: "recipientName",
        width: 150,
        pinned: "left",
        filter: true,
        enableRowGroup: true,
        hide: true,
      },
      {
        field: "consigneeName",
        tooltipField: "consigneeName",
        width: 200,
        pinned: "left",
        filter: true,
        enableRowGroup: true,
      },
      {
        field: "totalAmount",
        headerName: "Total Amt",
        width: 110,
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        pinned: "left",
        filter: "agMultiColumnFilter",
        aggFunc: "sum",
      },
      // Qty related columns
      {
        field: "totalQty",
        headerName: "Total Qty",
        width: 90,
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        cellStyle: qtyStyle,
        pinned: "left",
        filter: "agMultiColumnFilter",
        aggFunc: "sum",
        hide: !showQty,
      },
      {
        field: "avgQty",
        headerName: "Avg Qty",
        width: 90,
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        cellStyle: qtyStyle,
        pinned: "left",
        filter: "agMultiColumnFilter",
        valueGetter: (params) => {
          if (params.node?.group) {
            const totalQty = params.node.aggData?.totalQty ?? 0;
            return periods.length > 0 ? totalQty / periods.length : 0;
          }
          return params.data ? params.data.avgQty : null;
        },
        hide: !showQty,
      },
      {
        field: "qtyTrend",
        headerName: "Qty Trend",
        width: 150,
        cellRenderer: SparklineCellRenderer,
        cellStyle: qtyStyle,
        pinned: "left",
        hide: !showQty,
        valueGetter: (params) => {
          let trend: number[] = [];
          let avg = 0;
          let slope = 0;
          let intercept = 0;

          if (params.node?.group && params.node.aggData) {
            const aggData = params.node.aggData;
            trend = periods.map((p) => aggData[p] ?? 0);
            avg = params.getValue("avgQty") ?? 0;
            const reg = calculateRegression(trend);
            slope = reg.slope;
            intercept = reg.intercept;
          } else if (params.data) {
            const data = params.data;
            trend = periods.map((p) => data[p] ?? 0);
            avg = data["avgQty"] ?? 0;
            slope = data["slopeQty"] ?? 0;
            intercept = data["interceptQty"] ?? 0;
          }
          return { trend, avg, slope, intercept, isFlipped: isTimeFlipped };
        },
      },
      {
        field: "slopeQty",
        headerName: "Slope Qty",
        width: 80,
        type: "numericColumn",
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        cellStyle: qtyStyle,
        pinned: "left",
        hide: !showQty || !showStats,
      },
      {
        field: "stdDevQty",
        headerName: "SD Qty",
        width: 80,
        type: "numericColumn",
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        cellStyle: qtyStyle,
        pinned: "left",
        hide: !showQty || !showStats,
      },
      {
        field: "cvQty",
        headerName: "CV Qty",
        width: 70,
        type: "numericColumn",
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        cellStyle: qtyStyle,
        pinned: "left",
        hide: !showQty || !showStats,
      },
      // Rate related columns
      {
        field: "avgRate",
        headerName: "Avg Rate",
        width: 90,
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        cellStyle: rateStyle,
        pinned: "left",
        filter: "agMultiColumnFilter",
        valueGetter: (params) => {
          if (params.node && params.node.group) {
            const totalAmount = params.node.aggData
              ? params.node.aggData.totalAmount
              : 0;
            const totalQty = params.node.aggData
              ? params.node.aggData.totalQty
              : 0;
            return totalQty > 0 ? totalAmount / totalQty : 0;
          }
          return params.data ? params.data.avgRate : null;
        },
        hide: !showRate,
      },
      {
        field: "stdDevRate",
        headerName: "SD Rate",
        width: 80,
        type: "numericColumn",
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        cellStyle: rateStyle,
        pinned: "left",
        hide: !showRate || !showStats,
      },
      // Delta related columns
      {
        field: "totalDeltaAmount",
        headerName: "Total Delta Amt",
        width: 110,
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        pinned: "left",
        filter: "agMultiColumnFilter",
        aggFunc: "sum",
        hide: true,
      },
      {
        field: "avgDelta",
        headerName: "Avg Delta",
        width: 90,
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        cellStyle: deltaStyle,
        pinned: "left",
        filter: "agMultiColumnFilter",
        valueGetter: (params) => {
          if (params.node && params.node.group) {
            const totalDeltaAmount = params.node.aggData
              ? params.node.aggData.totalDeltaAmount
              : 0;
            const totalQty = params.node.aggData
              ? params.node.aggData.totalQty
              : 0;
            return totalQty > 0 ? totalDeltaAmount / totalQty : 0;
          }
          return params.data ? params.data.avgDelta : null;
        },
        hide: !showDelta,
      },
      {
        field: "deltaTrend",
        headerName: "Delta Trend",
        width: 150,
        cellRenderer: SparklineCellRenderer,
        cellStyle: deltaStyle,
        pinned: "left",
        hide: !showDelta,
        valueGetter: (params) => {
          let trend: number[] = [];
          let avg = 0;

          if (params.node?.group && params.node.aggData) {
            const aggData = params.node.aggData;
            trend = periods.map((p) => {
              const totalDeltaAmount = aggData[p + "-delta-amount"] ?? 0;
              const totalQty = aggData[p] ?? 0;
              return totalQty > 0 ? totalDeltaAmount / totalQty : 0;
            });
            const totalDeltaAmount = aggData.totalDeltaAmount ?? 0;
            const totalQty = aggData.totalQty ?? 0;
            avg = totalQty > 0 ? totalDeltaAmount / totalQty : 0;
          } else if (params.data) {
            const data = params.data;
            trend = periods.map((p) => data[p + "-delta"] ?? 0);
            avg = data["avgDelta"] ?? 0;
          }
          return { trend, avg, isFlipped: isTimeFlipped };
        },
      },
      {
        field: "slopeDelta",
        headerName: "Slope Delta",
        width: 80,
        type: "numericColumn",
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        cellStyle: deltaStyle,
        pinned: "left",
        hide: !showDelta || !showStats,
      },
      {
        field: "stdDevDelta",
        headerName: "SD Delta",
        width: 80,
        type: "numericColumn",
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        cellStyle: deltaStyle,
        pinned: "left",
        hide: !showDelta || !showStats,
      },
      {
        field: "cvDelta",
        headerName: "CV Delta",
        width: 70,
        type: "numericColumn",
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        cellStyle: deltaStyle,
        pinned: "left",
        hide: !showDelta || !showStats,
      },
    ];

    const displayPeriods = isTimeFlipped ? [...periods].reverse() : periods;

    displayPeriods.forEach((period) => {
      const date = new Date(parseInt(period));
      const headerName = date.toLocaleDateString(undefined, {
        year: "2-digit",
        month: "short",
      });

      defs.push({
        field: period,
        headerName: headerName + " Qty",
        width: 75,
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        cellStyle: qtyStyle,
        sortable: false,
        hide: !showQty,
        aggFunc: "sum",
      });

      // Hidden, used only for weighted avg rate calculation
      defs.push({
        field: period + "-amount",
        headerName: headerName + " Amt",
        width: 120,
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        sortable: false,
        hide: true,
        lockVisible: true,
        suppressColumnsToolPanel: true,
        aggFunc: "sum",
      });

      defs.push({
        field: period + "-rate",
        headerName: headerName + " Rate",
        width: 80,
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        cellStyle: rateStyle,
        sortable: false,
        hide: !showRate,
        valueGetter: (params) => {
          if (params.node && params.node.group) {
            const totalAmount = params.node.aggData
              ? params.node.aggData[period + "-amount"]
              : 0;
            const totalQty = params.node.aggData
              ? params.node.aggData[period]
              : 0;
            return totalQty > 0 ? totalAmount / totalQty : 0;
          }
          return params.data ? params.data[period + "-rate"] : null;
        },
      });

      defs.push({
        field: period + "-delta-amount",
        headerName: headerName + " Delta Amt",
        width: 120,
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        sortable: false,
        hide: true,
        lockVisible: true,
        suppressColumnsToolPanel: true,
        aggFunc: "sum",
      });

      defs.push({
        field: period + "-delta",
        headerName: headerName + " Delta",
        width: 80,
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        cellStyle: deltaStyle,
        sortable: false,
        hide: !showDelta,
        valueGetter: (params) => {
          if (params.node && params.node.group) {
            const totalDeltaAmount = params.node.aggData
              ? params.node.aggData[period + "-delta-amount"]
              : 0;
            const totalQty = params.node.aggData
              ? params.node.aggData[period]
              : 0;
            return totalQty > 0 ? totalDeltaAmount / totalQty : 0;
          }
          return params.data ? params.data[period + "-delta"] : null;
        },
      });
    });
    return defs;
  }, [periods, selectedGroups, showStats, isTimeFlipped]);

  useEffect(() => {
    if (gridApi) {
      const groupings = initialGrouping ? initialGrouping.split(",") : [];
      const activeGroupCols: string[] = [];

      if (groupings.includes("plant")) activeGroupCols.push("plant");
      if (groupings.includes("distChannel"))
        activeGroupCols.push("distChannelDescription");
      if (groupings.includes("recipient"))
        activeGroupCols.push("recipientName");

      const allPotentialGroupCols = [
        "plant",
        "distChannelDescription",
        "recipientName",
      ];

      const colsToHide = allPotentialGroupCols.filter(
        (c) => !activeGroupCols.includes(c),
      );

      gridApi.setRowGroupColumns(activeGroupCols);
      gridApi.setColumnsVisible(colsToHide, false);
    }
  }, [gridApi, initialGrouping]);

  return (
    <div className="grow min-h-0 flex flex-col gap-2">
      <div className="flex justify-end items-center gap-4">
        <Button
          variant="secondary"
          onClick={() => setIsTimeFlipped(!isTimeFlipped)}
          title="Flip time direction"
        >
          Time <ArrowRight className={isTimeFlipped ? "rotate-180" : ""} />
        </Button>
        {selectedGroups.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showStats}
              onChange={(e) => setShowStats(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show Stats
          </label>
        )}
        <div className="w-[300px]">
          <Select
            instanceId={instanceId}
            isMulti
            options={options}
            value={options.filter((o) => selectedGroups.includes(o.value))}
            onChange={(selected) =>
              setSelectedGroups(selected.map((s) => s.value))
            }
            placeholder="Select columns"
            classNames={{
              control: () => "!bg-background !border-input",
              menu: () => "!bg-popover !text-popover-foreground !z-[100]",
              option: ({ isFocused, isSelected, data }: any) => {
                let color = "!bg-[#fffbf2]";
                if (data.value === "rate") color = "!bg-[#fcf2ff]";
                if (data.value === "delta") color = "!bg-[#f2fff2]";
                return isFocused
                  ? "!bg-accent !text-accent-foreground"
                  : isSelected
                    ? "!bg-primary !text-primary-foreground"
                    : `${color} !text-foreground`;
              },
              multiValue: ({ data }: any) => {
                let color = "!bg-[#fffbf2]";
                if (data.value === "rate") color = "!bg-[#fcf2ff]";
                if (data.value === "delta") color = "!bg-[#f2fff2]";
                return `${color} !text-foreground`;
              },
              multiValueLabel: () => "!text-foreground",
              multiValueRemove: () =>
                "!text-foreground hover:!bg-destructive hover:!text-destructive-foreground",
            }}
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
          rowData={rowData}
          columnDefs={colDefs}
          defaultColDef={defaultColDef}
          autoGroupColumnDef={autoGroupColumnDef}
          headerHeight={60}
          rowHeight={45}
          pagination
          suppressMovableColumns
          processUnpinnedColumns={() => []}
          onGridReady={(params) => setGridApi(params.api)}
          rowGroupPanelShow="always"
          suppressAggFuncInHeader
          enableBrowserTooltips
          grandTotalRow="top"
        />
      </div>
    </div>
  );
};
