"use client";

import { use, useMemo, useState, useEffect } from "react";

import type { ColDef, GridApi } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { getTopCustomers } from "@/lib/api";
import { formatIndianNumber } from "@/lib/utils/format";
import Select from "react-select";

ModuleRegistry.registerModules([AllCommunityModule]);

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

    const defs: ColDef<GridRow>[] = [
      { field: "consigneeName", width: 250, pinned: "left", filter: true },
    ];

    if (showQty) {
      defs.push(
        {
          field: "cvQty",
          headerName: "CV Qty",
          valueFormatter: (params) =>
            params.value != null ? params.value.toFixed(2) : "",
          width: 110,
          pinned: "left",
        },
        {
          field: "avgQty",
          headerName: "Avg Qty",
          type: "numericColumn",
          valueFormatter: (params) => formatIndianNumber(params.value),
          width: 120,
          pinned: "left",
          filter: true,
        },
      );
    }

    if (showRate) {
      defs.push(
        {
          field: "cvRate",
          headerName: "CV Rate",
          valueFormatter: (params) =>
            params.value != null ? params.value.toFixed(2) : "",
          width: 110,
          pinned: "left",
        },
        {
          field: "avgRate",
          headerName: "Avg Rate",
          type: "numericColumn",
          valueFormatter: (params) => formatIndianNumber(params.value),
          width: 120,
          pinned: "left",
          filter: true,
        },
      );
    }

    if (showQty) {
      defs.push(
        {
          field: "totalQty",
          headerName: "Total Qty",
          type: "numericColumn",
          valueFormatter: (params) => formatIndianNumber(params.value),
          width: 140,
          filter: true,
        },
        {
          field: "stdDevQty",
          headerName: "SD Qty",
          type: "numericColumn",
          valueFormatter: (params) =>
            params.value != null ? params.value.toFixed(2) : "",
          width: 100,
        },
      );
    }

    defs.push({
      field: "totalAmount",
      headerName: "Total Amount",
      type: "numericColumn",
      valueFormatter: (params) => formatIndianNumber(params.value),
      width: 140,
    });

    if (showRate) {
      defs.push({
        field: "stdDevRate",
        headerName: "SD Rate",
        type: "numericColumn",
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        width: 100,
      });
    }

    periods.forEach((period) => {
      const date = new Date(parseInt(period));
      const headerName = date.toLocaleDateString(undefined, {
        year: "2-digit",
        month: "short",
      });

      if (showQty) {
        defs.push({
          field: period,
          headerName: headerName,
          type: "numericColumn",
          valueFormatter: (params) => formatIndianNumber(params.value),
          width: 90,
          sortable: false,
        });
      }

      if (showRate) {
        defs.push({
          field: period + "-rate",
          headerName: headerName,
          type: "numericColumn",
          valueFormatter: (params) => formatIndianNumber(params.value),
          width: 90,
          sortable: false,
        });
      }
    });
    return defs;
  }, [periods, selectedGroups]);

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
      <div className="flex justify-end">
        <div className="w-[300px]">
          <Select
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
              option: ({ isFocused, isSelected }) =>
                isFocused
                  ? "!bg-accent !text-accent-foreground"
                  : isSelected
                    ? "!bg-primary !text-primary-foreground"
                    : "!bg-transparent !text-foreground",
              multiValue: () => "!bg-accent !text-accent-foreground",
              multiValueLabel: () => "!text-accent-foreground",
              multiValueRemove: () =>
                "!text-accent-foreground hover:!bg-destructive hover:!text-destructive-foreground",
            }}
          />
        </div>
      </div>
      <div className="grow min-h-0">
        <AgGridReact
          rowData={rowData}
          columnDefs={colDefs}
          pagination
          onGridReady={(params) => setGridApi(params.api)}
        />
      </div>
    </div>
  );
};
