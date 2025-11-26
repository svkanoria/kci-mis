"use client";

import { use, useState, useMemo } from "react";

import type { ColDef } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { getQtyByConsigneeAndPeriod } from "@/lib/api";
import { formatIndianNumber } from "@/lib/utils/format";

ModuleRegistry.registerModules([AllCommunityModule]);

type IRow = Awaited<ReturnType<typeof getQtyByConsigneeAndPeriod>>[number];

interface GridRow {
  consigneeName: string | null;
  [key: string]: string | number | null;
}

export const DataGrid = ({ data }: { data: Promise<IRow[]> }) => {
  const groupedData = use(data);

  const periods = useMemo(() => {
    const allPeriods = new Set<string>();
    groupedData.forEach((group) => {
      group.series.forEach((item) => {
        const p = item.period.getTime().toString();
        allPeriods.add(p);
      });
    });
    return Array.from(allPeriods)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .reverse();
  }, [groupedData]);

  const rowData = useMemo<GridRow[]>(() => {
    return groupedData.map((group) => {
      const row: GridRow = { consigneeName: group.key };
      group.series.forEach((item) => {
        const p = item.period.getTime().toString();
        row[p] = item.value;
      });
      return row;
    });
  }, [groupedData]);

  const colDefs = useMemo<ColDef<GridRow>[]>(() => {
    const defs: ColDef<GridRow>[] = [
      { field: "consigneeName", filter: true, pinned: "left", width: 200 },
    ];

    periods.forEach((period) => {
      const date = new Date(parseInt(period));
      const headerName = date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      defs.push({
        field: period,
        headerName: headerName,
        type: "numericColumn",
        valueFormatter: (params) => formatIndianNumber(params.value),
        width: 120,
      });
    });
    return defs;
  }, [periods]);

  return (
    <div className="grow min-h-0">
      <AgGridReact rowData={rowData} columnDefs={colDefs} pagination />
    </div>
  );
};
