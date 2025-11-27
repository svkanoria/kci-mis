"use client";

import { use, useMemo, useState, useEffect } from "react";

import type { ColDef, GridApi } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { getTopCustomers } from "@/lib/api";
import { formatIndianNumber } from "@/lib/utils/format";

ModuleRegistry.registerModules([AllCommunityModule]);

type IRow = Awaited<ReturnType<typeof getTopCustomers>>[number];

interface GridRow {
  consigneeName: string | null;
  [key: string]: string | number | null;
}

export const DataGrid = ({ data }: { data: Promise<IRow[]> }) => {
  const groupedData = use(data);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

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
      series.forEach(({ periodStart, value: { qty } }) => {
        const p = periodStart.getTime().toString();
        row[p] = qty;
      });
      return row;
    });
  }, [groupedData]);

  const colDefs = useMemo<ColDef<GridRow>[]>(() => {
    const defs: ColDef<GridRow>[] = [
      { field: "consigneeName", width: 250, pinned: "left", filter: true },
      {
        field: "cvQty",
        headerName: "CV Qty",
        valueFormatter: (params) =>
          params.value != null ? params.value.toFixed(2) : "",
        width: 110,
        pinned: "left",
      },
      {
        field: "averageQty",
        headerName: "Avg Qty",
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        width: 120,
        pinned: "left",
        filter: true,
      },
      {
        field: "totalQty",
        headerName: "Total Qty",
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        width: 120,
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
        width: 90,
        sortable: false,
      });
    });
    return defs;
  }, [periods]);

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
    <div className="grow min-h-0">
      <AgGridReact
        rowData={rowData}
        columnDefs={colDefs}
        pagination
        onGridReady={(params) => setGridApi(params.api)}
      />
    </div>
  );
};
