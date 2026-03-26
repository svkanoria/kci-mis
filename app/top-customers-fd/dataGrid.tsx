"use client";

import { use, useMemo, useState, useEffect, useId } from "react";

import { ModuleRegistry, SortChangedEvent } from "ag-grid-community";
import {
  AllEnterpriseModule,
  LicenseManager,
  ColDef,
  GridApi,
} from "ag-grid-enterprise";
import { AgGridReact } from "ag-grid-react";
import { getTopCustomersFD } from "@/lib/api";
import { formatIndianNumber } from "@/lib/utils/format";
import Select from "react-select";
import { calculateRegression } from "@/lib/utils/stats";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { TimeDirectionButton } from "@/app/_components/timeDirectionButton";
import { useTimeDirectionStore } from "@/lib/store";
import {
  SparklineCellRenderer,
  BarSparklineCellRenderer,
} from "./cellRenderers";
import {
  RecipientNameCellRenderer,
  ConsigneeNameCellRenderer,
} from "@/app/_utils/cellRenderers";

// Register License Key with LicenseManager
LicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_GRID_LICENSE || "");

ModuleRegistry.registerModules([AllEnterpriseModule]);

type IRow = Awaited<ReturnType<typeof getTopCustomersFD>>[number];

const lsKey = (key: string) => `top-customers-fd-${key}`;
const SHOW_STATS_KEY = lsKey("showStats");
const SELECTED_GROUPS_KEY = lsKey("selectedGroups");
const GRID_SORT_KEY = lsKey("sort");

interface GridRow {
  consigneeName: string | null;
  [key: string]: any;
}

export const DataGrid = ({
  data,
  initialGrouping,
  destination,
}: {
  data: Promise<IRow[]>;
  initialGrouping?: string;
  destination?: string;
}) => {
  const groupedData = use(data);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [showStats, setShowStats] = useState(false);
  const { isTimeFlipped } = useTimeDirectionStore();
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
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

  useEffect(() => {
    const storedShowStats = localStorage.getItem(SHOW_STATS_KEY);
    if (storedShowStats !== null) {
      setShowStats(storedShowStats === "true");
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
      localStorage.setItem(SELECTED_GROUPS_KEY, JSON.stringify(selectedGroups));
    }
  }, [showStats, selectedGroups, isInitialized]);

  useEffect(() => {
    if (gridApi && destination) {
      gridApi
        .setColumnFilterModel("destination", {
          values: [destination],
          filterType: "set",
        })
        .then(() => {
          gridApi.onFilterChanged();
        });
    }
  }, [gridApi, destination]);

  useEffect(() => {
    if (gridApi && showStats) {
      const allCols = gridApi.getColumns();
      if (allCols) {
        const firstUnpinned = allCols.find(
          (c) => !c.isPinned() && c.isVisible(),
        );
        if (firstUnpinned) {
          gridApi.ensureColumnVisible(firstUnpinned, "start");
        }
      }
    }
  }, [gridApi, showStats]);

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
    let width = 220;
    const groupings = initialGrouping ? initialGrouping.split(",") : [];

    if (groupings.length === 1 && groupings.includes("plant")) {
      width = 120;
    } else if (groupings.length === 1 && groupings.includes("distChannel")) {
      width = 130;
    } else if (
      groupings.length === 2 &&
      groupings.includes("plant") &&
      groupings.includes("distChannel")
    ) {
      width = 150;
    } else if (
      groupings.length === 2 &&
      groupings.includes("plant") &&
      groupings.includes("routeDistance")
    ) {
      width = 170;
    } // In all other cases, the default width (of around 200+) is fine

    return {
      width,
      pinned: "left",
      tooltipValueGetter: (params: any) => {
        if (params.node.group) {
          return `Group: ${params.value}`;
        }
        return "";
      },
    };
  }, [initialGrouping]);

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
        hide: true,
        pinned: "left",
        filter: true,
        sortable: false,
        enableRowGroup: true,
      },
      {
        field: "routeDistanceBucket",
        headerName: "Route Distance",
        width: 140,
        hide: true,
        pinned: "left",
        filter: true,
        enableRowGroup: true,
        valueFormatter: (params) => {
          if (params.value < 0) return "N/A";
          return `${params.value} - ${params.value + 100} km`;
        },
      },
      {
        field: "destination",
        headerName: "Destination",
        width: 150,
        hide: true,
        pinned: "left",
        filter: true,
        enableRowGroup: true,
        cellRenderer: (params: any) => {
          if (!params.value) return null;
          const [city, ...regionParts] = params.value.split(", ");
          const region = regionParts.join(", ");

          if (!region) return params.value;

          return (
            <div className="flex flex-col justify-center h-full leading-tight pr-1 pt-1">
              <span className="truncate">{city}</span>
              <span className="truncate text-xs text-muted-foreground">
                {region}
              </span>
            </div>
          );
        },
      },
      {
        field: "distChannelDescription",
        headerName: "Dist. Channel",
        width: 150,
        hide: true,
        pinned: "left",
        filter: true,
        enableRowGroup: true,
      },
      {
        field: "recipientName",
        width: 150,
        hide: true,
        pinned: "left",
        filter: true,
        enableRowGroup: true,
        cellRenderer: RecipientNameCellRenderer,
      },
      {
        field: "consigneeName",
        tooltipField: "consigneeName",
        width: 200,
        pinned: "left",
        filter: true,
        enableRowGroup: true,
        cellRenderer: ConsigneeNameCellRenderer,
      },
      {
        field: "totalAmount",
        headerName: "Total Amt",
        width: 110,
        type: "numericColumn",
        pinned: "left",
        filter: "agMultiColumnFilter",
        aggFunc: "sum",
        valueFormatter: (params) => formatIndianNumber(params.value),
      },
      // Qty related columns
      {
        field: "totalQty",
        headerName: "Total Qty",
        width: 90,
        type: "numericColumn",
        hide: !showQty,
        pinned: "left",
        filter: "agMultiColumnFilter",
        aggFunc: "sum",
        valueFormatter: (params) => formatIndianNumber(params.value),
        cellStyle: qtyStyle,
      },
      {
        field: "avgQty",
        headerName: "Avg Qty",
        width: 85,
        type: "numericColumn",
        hide: !showQty,
        pinned: "left",
        filter: "agMultiColumnFilter",
        valueFormatter: (params) => formatIndianNumber(params.value),
        valueGetter: (params) => {
          if (params.node?.group) {
            const totalQty = params.node.aggData?.totalQty ?? 0;
            return periods.length > 0 ? totalQty / periods.length : 0;
          }
          return params.data ? params.data.avgQty : null;
        },
        cellStyle: qtyStyle,
      },
      {
        field: "qtyTrend",
        headerName: "Qty Trend",
        width: 150,
        hide: !showQty,
        sortable: false,
        pinned: "left",
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
        cellRenderer: SparklineCellRenderer,
        cellStyle: qtyStyle,
      },
      {
        field: "slopeQty",
        headerName: "Slope Qty",
        width: 80,
        type: "numericColumn",
        hide: !showQty || !showStats,
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        valueGetter: (params) => {
          if (params.node?.group && params.node.aggData) {
            const aggData = params.node.aggData;
            const trend = periods.map((p) => aggData[p] ?? 0);
            const reg = calculateRegression(trend);
            return reg.slope;
          }
          return params.data ? params.data["slopeQty"] : null;
        },
        cellStyle: qtyStyle,
      },
      {
        field: "stdDevQty",
        headerName: "SD Qty",
        width: 80,
        type: "numericColumn",
        hide: !showQty || !showStats,
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        cellStyle: qtyStyle,
      },
      {
        field: "cvQty",
        headerName: "CV Qty",
        width: 70,
        type: "numericColumn",
        hide: !showQty || !showStats,
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        cellStyle: qtyStyle,
      },
      // Rate related columns
      {
        field: "avgRate",
        headerName: "Avg Rate",
        width: 90,
        type: "numericColumn",
        hide: !showRate,
        pinned: "left",
        filter: "agMultiColumnFilter",
        valueFormatter: (params) => formatIndianNumber(params.value),
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
        cellStyle: rateStyle,
      },
      {
        field: "stdDevRate",
        headerName: "SD Rate",
        width: 80,
        type: "numericColumn",
        hide: !showRate || !showStats,
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        cellStyle: rateStyle,
      },
      // Delta related columns
      {
        field: "totalDeltaAmount",
        headerName: "Total Delta Amt",
        width: 110,
        type: "numericColumn",
        hide: true,
        pinned: "left",
        filter: "agMultiColumnFilter",
        aggFunc: "sum",
        valueFormatter: (params) => formatIndianNumber(params.value),
      },
      {
        field: "avgDelta",
        headerName: "Avg Delta",
        width: 85,
        type: "numericColumn",
        hide: !showDelta,
        pinned: "left",
        filter: "agMultiColumnFilter",
        valueFormatter: (params) => formatIndianNumber(params.value),
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
        cellStyle: deltaStyle,
      },
      {
        field: "deltaTrend",
        headerName: "Delta Trend",
        width: 150,
        hide: !showDelta,
        sortable: false,
        pinned: "left",
        valueGetter: (params) => {
          let trend: number[] = [];
          let avg = 0;

          if (params.node?.group && params.node.aggData) {
            const aggData = params.node.aggData;
            const rawTrend = periods.map((p) => {
              const totalDeltaAmount = aggData[p + "-delta-amount"] ?? 0;
              const totalQty = aggData[p] ?? 0;
              return totalQty > 0 ? totalDeltaAmount / totalQty : null;
            });
            trend = rawTrend.map((v) => v ?? 0);
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
        cellRenderer: BarSparklineCellRenderer,
        cellStyle: deltaStyle,
      },
      {
        field: "slopeDelta",
        headerName: "Slope Delta",
        width: 80,
        type: "numericColumn",
        hide: !showDelta || !showStats,
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        valueGetter: (params) => {
          if (params.node?.group && params.node.aggData) {
            const aggData = params.node.aggData;
            const rawTrend = periods.map((p) => {
              const totalDeltaAmount = aggData[p + "-delta-amount"] ?? 0;
              const totalQty = aggData[p] ?? 0;
              return totalQty > 0 ? totalDeltaAmount / totalQty : 0;
            });
            const reg = calculateRegression(rawTrend);
            return reg.slope;
          } else if (params.data) {
            return params.data["slopeDelta"] ?? 0;
          }
          return null;
        },
        cellStyle: deltaStyle,
      },
      {
        field: "stdDevDelta",
        headerName: "SD Delta",
        width: 80,
        type: "numericColumn",
        hide: !showDelta || !showStats,
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        cellStyle: deltaStyle,
      },
      {
        field: "cvDelta",
        headerName: "CV Delta",
        width: 70,
        type: "numericColumn",
        hide: !showDelta || !showStats,
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        cellStyle: deltaStyle,
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
        hide: !showQty,
        sortable: false,
        aggFunc: "sum",
        valueFormatter: (params) => formatIndianNumber(params.value),
        cellStyle: qtyStyle,
      });

      // Hidden, used only for weighted avg rate calculation
      defs.push({
        field: period + "-amount",
        headerName: headerName + " Amt",
        width: 120,
        type: "numericColumn",
        hide: true,
        lockVisible: true,
        suppressColumnsToolPanel: true,
        sortable: false,
        aggFunc: "sum",
        valueFormatter: (params) => formatIndianNumber(params.value),
      });

      defs.push({
        field: period + "-rate",
        headerName: headerName + " Rate",
        width: 80,
        type: "numericColumn",
        hide: !showRate,
        sortable: false,
        valueFormatter: (params) => formatIndianNumber(params.value),
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
        cellStyle: rateStyle,
      });

      defs.push({
        field: period + "-delta-amount",
        headerName: headerName + " Delta Amt",
        width: 120,
        type: "numericColumn",
        hide: true,
        lockVisible: true,
        suppressColumnsToolPanel: true,
        sortable: false,
        aggFunc: "sum",
        valueFormatter: (params) => formatIndianNumber(params.value),
      });

      defs.push({
        field: period + "-delta",
        headerName: headerName + " Delta",
        width: 80,
        type: "numericColumn",
        hide: !showDelta,
        sortable: false,
        valueFormatter: (params) => formatIndianNumber(params.value),
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
        cellStyle: deltaStyle,
      });
    });
    return defs;
  }, [periods, selectedGroups, showStats, isTimeFlipped]);

  useEffect(() => {
    if (gridApi) {
      const groupings = initialGrouping ? initialGrouping.split(",") : [];
      const activeGroupCols: string[] = [];

      if (groupings.includes("plant")) activeGroupCols.push("plant");
      if (groupings.includes("routeDistance"))
        activeGroupCols.push("routeDistanceBucket");
      if (groupings.includes("destination"))
        activeGroupCols.push("destination");
      if (groupings.includes("distChannel"))
        activeGroupCols.push("distChannelDescription");
      if (groupings.includes("recipient"))
        activeGroupCols.push("recipientName");

      const allPotentialGroupCols = [
        "plant",
        "routeDistanceBucket",
        "destination",
        "distChannelDescription",
        "recipientName",
      ];

      const colsToHide = allPotentialGroupCols.filter(
        (c) => !activeGroupCols.includes(c),
      );

      gridApi.setRowGroupColumns(activeGroupCols);
      gridApi.setColumnsVisible(colsToHide, false);

      if (destination) {
        gridApi.expandAll();
      }
    }
  }, [gridApi, initialGrouping, destination]);

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
          {selectedGroups.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showStats}
                  onChange={(e) => setShowStats(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Show Stats
              </label>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Stats columns show up to the left of the time-series columns
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
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
          rowData={rowData}
          columnDefs={colDefs}
          defaultColDef={defaultColDef}
          autoGroupColumnDef={autoGroupColumnDef}
          headerHeight={60}
          rowHeight={45}
          grandTotalRow="top"
          pagination
          rowGroupPanelShow="always"
          suppressAggFuncInHeader
          suppressAggFilteredOnly
          enableBrowserTooltips
          suppressMovableColumns
          processUnpinnedColumns={() => []}
          onGridReady={onGridReady}
          onSortChanged={onSortChanged}
          sideBar={{
            toolPanels: ["filters"],
            defaultToolPanel: "",
          }}
        />
      </div>
    </div>
  );
};
