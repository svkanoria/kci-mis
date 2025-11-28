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

export const DataGrid = ({ data }: { data: Promise<IRow[]> }) => {
  const groupedData = use(data);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([
    "qty",
    "rate",
  ]);
  const [showStats, setShowStats] = useState(true);
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

  const rowData = useMemo<GridRow[]>(() => {
    return groupedData.map(({ series, ...rest }) => {
      const row: GridRow = {
        ...rest,
      };
      series.forEach(({ periodStart, value: { qty, rate } }) => {
        const p = periodStart.getTime().toString();
        row[p] = qty;
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
      { field: "consigneeName", width: 250, pinned: "left", filter: true },
      {
        field: "totalAmount",
        headerName: "Total Amt",
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        width: 125,
        pinned: "left",
        filter: true,
      },
      {
        field: "totalQty",
        headerName: "Total Qty",
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        width: 120,
        pinned: "left",
        filter: true,
        cellStyle: qtyStyle,
      },
      {
        field: "avgQty",
        headerName: "Avg Qty",
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        width: 110,
        pinned: "left",
        filter: true,
        cellStyle: qtyStyle,
      },
      {
        field: "avgRate",
        headerName: "Avg Rate",
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        width: 110,
        pinned: "left",
        filter: true,
        cellStyle: rateStyle,
      },
      {
        field: "stdDevQty",
        headerName: "SD Qty",
        type: "numericColumn",
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        width: 90,
        pinned: "left",
        hide: !showQty || !showStats,
        cellStyle: qtyStyle,
      },
      {
        field: "stdDevRate",
        headerName: "SD Rate",
        type: "numericColumn",
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        width: 90,
        pinned: "left",
        hide: !showRate || !showStats,
        cellStyle: rateStyle,
      },
      {
        field: "cvQty",
        headerName: "CV Qty",
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        width: 85,
        pinned: "left",
        hide: !showQty || !showStats,
        cellStyle: qtyStyle,
      },
      {
        field: "cvRate",
        headerName: "CV Rate",
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        width: 85,
        pinned: "left",
        hide: !showRate || !showStats,
        cellStyle: rateStyle,
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
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        width: 80,
        sortable: false,
        hide: !showQty,
        cellStyle: qtyStyle,
      });

      defs.push({
        field: period + "-rate",
        headerName: headerName,
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        width: 85,
        sortable: false,
        hide: !showRate,
        cellStyle: rateStyle,
      });
    });
    return defs;
  }, [periods, selectedGroups, showStats]);

  useEffect(() => {
    if (gridApi) {
      const sortState = gridApi.getColumnState();
      const isSorted = sortState.some((col) => col.sort !== null);
      if (!isSorted) {
        gridApi.applyColumnState({
          state: [{ colId: "totalQty", sort: "desc" }],
        });
      }
    }
  }, [rowData, gridApi]);

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
        style={{ "--ag-spacing": "4px" } as React.CSSProperties}
      >
        <AgGridReact
          rowData={rowData}
          columnDefs={colDefs}
          pagination
          suppressMovableColumns
          processUnpinnedColumns={() => []}
          onGridReady={(params) => setGridApi(params.api)}
        />
      </div>
    </div>
  );
};
