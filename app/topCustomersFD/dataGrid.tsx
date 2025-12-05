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

// Register License Key with LicenseManager
LicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_GRID_LICENSE || "");

ModuleRegistry.registerModules([AllEnterpriseModule]);

type IRow = Awaited<ReturnType<typeof getTopCustomers>>[number];

interface GridRow {
  consigneeName: string | null;
  [key: string]: string | number | null;
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
  const [selectedGroups, setSelectedGroups] = useState<string[]>([
    "qty",
    "rate",
  ]);
  const [showStats, setShowStats] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("topCustomersFD-showStats");
    if (stored !== null) {
      setShowStats(stored === "true");
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("topCustomersFD-showStats", String(showStats));
    }
  }, [showStats, isInitialized]);

  const instanceId = useId();

  const options = [
    { value: "qty", label: "Quantity" },
    { value: "rate", label: "Rate" },
  ];

  const periods = useMemo(() => {
    const allPeriods = new Set<string>();
    groupedData.forEach((group) => {
      group.series.forEach(({ periodStart }) => {
        const p = periodStart.getTime().toString();
        allPeriods.add(p);
      });
    });
    return Array.from(allPeriods)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .reverse();
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
      series.forEach(({ periodStart, value: { qty, amount, rate } }) => {
        const p = periodStart.getTime().toString();
        row[p] = qty;
        row[p + "-amount"] = amount;
        row[p + "-rate"] = rate;
      });
      return row;
    });
  }, [groupedData]);

  const colDefs = useMemo<ColDef<GridRow>[]>(() => {
    const showQty = selectedGroups.includes("qty");
    const showRate = selectedGroups.includes("rate");

    const qtyStyle = { backgroundColor: "rgba(255, 235, 205, 0.3)" };
    const rateStyle = { backgroundColor: "rgba(240, 200, 255, 0.3)" };

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
        aggFunc: "avg",
      },
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
    ];

    periods.forEach((period) => {
      const date = new Date(parseInt(period));
      const headerName = date.toLocaleDateString(undefined, {
        year: "2-digit",
        month: "short",
      });

      defs.push({
        field: period,
        headerName: headerName,
        width: 80,
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
        headerName: headerName,
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
        headerName: headerName,
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
    });
    return defs;
  }, [periods, selectedGroups, showStats]);

  useEffect(() => {
    if (gridApi) {
      const cols: string[] = [
        "plant",
        "distChannelDescription",
        "recipientName",
      ];

      let index = 3;
      if (initialGrouping === "plant") {
        index = 0;
      } else if (initialGrouping === "distChannel") {
        index = 1;
      } else if (initialGrouping === "recipient") {
        index = 2;
      }

      const groupCols = cols.slice(index);
      const emptyCols = cols.slice(0, index);
      gridApi.setRowGroupColumns(groupCols);
      gridApi.setColumnsVisible(emptyCols, false);
    }
  }, [gridApi, initialGrouping]);

  return (
    <div className="grow min-h-0 flex flex-col gap-2">
      <div className="flex justify-end items-center gap-4">
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
                const color =
                  data.value === "qty" ? "!bg-[#fffbf2]" : "!bg-[#fcf2ff]";
                return isFocused
                  ? "!bg-accent !text-accent-foreground"
                  : isSelected
                    ? "!bg-primary !text-primary-foreground"
                    : `${color} !text-foreground`;
              },
              multiValue: ({ data }: any) => {
                const color =
                  data.value === "qty" ? "!bg-[#fffbf2]" : "!bg-[#fcf2ff]";
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
          pagination
          suppressMovableColumns
          processUnpinnedColumns={() => []}
          onGridReady={(params) => setGridApi(params.api)}
          rowGroupPanelShow="always"
          suppressAggFuncInHeader
          enableBrowserTooltips
        />
      </div>
    </div>
  );
};
