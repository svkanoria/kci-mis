"use client";

import React, { use, useState, useMemo } from "react";
import { ModuleRegistry, SortChangedEvent } from "ag-grid-community";
import {
  AllEnterpriseModule,
  LicenseManager,
  ColDef,
  GridApi,
} from "ag-grid-enterprise";
import { AgGridReact } from "ag-grid-react";
import { ConsigneeOverlapSummary } from "@/lib/api/contract-overlaps";
import { formatIndianNumber } from "@/lib/utils/format";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  FileText,
  ChartNoAxesGantt,
  MapPin,
} from "lucide-react";
import { differenceInDays, parseISO, isValid } from "date-fns";

// Register License Key with LicenseManager
LicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_GRID_LICENSE || "");

ModuleRegistry.registerModules([AllEnterpriseModule]);

const lsKey = (key: string) => `contract-overlaps-${key}`;
const GRID_SORT_KEY = lsKey("sort");

function getContractDurationDays(
  contractDate?: string | null,
  completionDate?: string | null,
): string {
  if (!contractDate || !completionDate) return "N/A";
  const start = parseISO(contractDate);
  const end = parseISO(completionDate);
  if (!isValid(start) || !isValid(end)) return "N/A";
  const days = differenceInDays(end, start);
  return days >= 0 ? `${days} days` : "N/A";
}

interface DataGridProps {
  queryResult: Promise<ConsigneeOverlapSummary[]>;
}

export function DataGrid({ queryResult }: DataGridProps) {
  const data = use(queryResult);

  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "overlaps" | "flagged">(
    "all",
  );
  const [selectedConsignee, setSelectedConsignee] =
    useState<ConsigneeOverlapSummary | null>(null);

  // Filtered dataset based on search term & filter mode
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (filterMode === "overlaps" && item.overlapCount === 0) return false;
      if (filterMode === "flagged" && item.lowerPriceOverlapCount === 0)
        return false;

      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase();
      return (
        item.consigneeName.toLowerCase().includes(term) ||
        item.consigneeCity.toLowerCase().includes(term) ||
        item.consigneeRegion.toLowerCase().includes(term)
      );
    });
  }, [data, searchTerm, filterMode]);

  // Aggregate Metrics for filter toolbar buttons
  const metrics = useMemo(() => {
    const consigneesWithOverlaps = data.filter(
      (c) => c.overlapCount > 0,
    ).length;
    const consigneesWithFlaggedOverlaps = data.filter(
      (c) => c.lowerPriceOverlapCount > 0,
    ).length;

    return {
      consigneesWithOverlaps,
      consigneesWithFlaggedOverlaps,
    };
  }, [data]);

  const onGridReady = (params: import("ag-grid-community").GridReadyEvent) => {
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
      sortable: true,
      resizable: true,
    };
  }, []);

  const colDefs = useMemo<ColDef<ConsigneeOverlapSummary>[]>(() => {
    return [
      {
        field: "consigneeName",
        headerName: "Consignee Name",
        width: 250,
        filter: "agTextColumnFilter",
        tooltipField: "consigneeName",
      },
      {
        headerName: "Location",
        width: 180,
        filter: "agTextColumnFilter",
        valueGetter: (params) => {
          if (!params.data) return "";
          return `${params.data.consigneeCity}, ${params.data.consigneeRegion}`;
        },
        tooltipValueGetter: (params) => params.value,
      },
      {
        field: "lowerPriceOverlapCount",
        headerName: "Flagged",
        width: 120,
        type: "numericColumn",
        sort: "desc",
        filter: "agNumberColumnFilter",
      },
      {
        field: "overlapCount",
        headerName: "Total Overlaps",
        width: 140,
        type: "numericColumn",
        filter: "agNumberColumnFilter",
      },
      {
        headerName: "% Flagged",
        width: 120,
        type: "numericColumn",
        filter: "agNumberColumnFilter",
        valueGetter: (params) => {
          if (
            !params.data ||
            !params.data.overlapCount ||
            params.data.overlapCount === 0
          ) {
            return 0;
          }
          return (
            (params.data.lowerPriceOverlapCount / params.data.overlapCount) *
            100
          );
        },
        valueFormatter: (params) => {
          if (params.value == null) return "0.0%";
          return `${Number(params.value).toFixed(1)}%`;
        },
      },
      {
        field: "totalContracts",
        headerName: "Contracts",
        width: 110,
        type: "numericColumn",
        filter: "agNumberColumnFilter",
      },
      {
        field: "totalQty",
        headerName: "Total Qty (MT)",
        width: 150,
        type: "numericColumn",
        filter: "agNumberColumnFilter",
        valueFormatter: (params) =>
          params.value != null ? formatIndianNumber(params.value) : "",
      },
      {
        headerName: "Actions",
        width: 100,
        sortable: false,
        filter: false,
        resizable: false,
        suppressHeaderMenuButton: true,
        cellClass: "no-focus-outline flex items-center justify-center",
        cellRenderer: (params: any) => {
          if (!params.data) return null;
          return (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs font-medium mt-0.5"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedConsignee(params.data);
              }}
            >
              Analyse
            </Button>
          );
        },
      },
    ];
  }, []);

  return (
    <div className="grow min-h-0 flex flex-col gap-2">
      {/* Toolbar & Search */}
      <div className="flex justify-between items-center gap-4">
        <div className="w-72">
          <Input
            placeholder="Quick search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5 bg-background text-xs">
            <button
              className={`px-3 py-1.5 rounded-sm font-medium transition-colors ${
                filterMode === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setFilterMode("all")}
            >
              All ({data.length})
            </button>
            <button
              className={`px-3 py-1.5 rounded-sm font-medium transition-colors ${
                filterMode === "overlaps"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setFilterMode("overlaps")}
            >
              Any Overlaps ({metrics.consigneesWithOverlaps})
            </button>
            <button
              className={`px-3 py-1.5 rounded-sm font-medium transition-colors ${
                filterMode === "flagged"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-rose-600 hover:bg-rose-50"
              }`}
              onClick={() => setFilterMode("flagged")}
            >
              Flagged Overlaps Only ({metrics.consigneesWithFlaggedOverlaps})
            </button>
          </div>
        </div>
      </div>

      {/* Consignees AgGrid */}
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
          quickFilterText={searchTerm}
          rowData={filteredData}
          columnDefs={colDefs}
          defaultColDef={defaultColDef}
          headerHeight={45}
          rowHeight={45}
          pagination
          enableBrowserTooltips
          onGridReady={onGridReady}
          onSortChanged={onSortChanged}
          onRowClicked={(params) =>
            params.data && setSelectedConsignee(params.data)
          }
        />
      </div>

      {/* Consignee Detail Inspector Drawer */}
      {selectedConsignee && (
        <Sheet
          open={!!selectedConsignee}
          onOpenChange={(open) => !open && setSelectedConsignee(null)}
        >
          <SheetContent className="w-full sm:max-w-4xl h-full flex flex-col p-6 overflow-hidden">
            <SheetHeader className="pb-4 border-b shrink-0">
              <SheetTitle className="text-xl font-bold text-foreground">
                {selectedConsignee.consigneeName}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />{" "}
                  {selectedConsignee.consigneeCity},{" "}
                  {selectedConsignee.consigneeRegion}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />{" "}
                  {selectedConsignee.totalContracts} Total Contracts
                </span>
                <span className="flex items-center gap-1 font-semibold text-rose-600">
                  <AlertTriangle className="w-3.5 h-3.5" />{" "}
                  {selectedConsignee.lowerPriceOverlapCount} Flagged Overlaps
                </span>
                <span className="flex items-center gap-1 font-medium text-amber-700">
                  <ChartNoAxesGantt className="w-3.5 h-3.5" />{" "}
                  {selectedConsignee.overlapCount} Total Overlaps
                </span>
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 flex-1 flex flex-col min-h-0">
              <Tabs
                defaultValue="overlaps"
                className="w-full flex-1 flex flex-col min-h-0"
              >
                <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 gap-6 shrink-0">
                  <TabsTrigger
                    value="overlaps"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 pb-2 pt-1 font-medium text-sm"
                  >
                    Overlapping Instances (
                    {selectedConsignee.overlappingInstances.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="timeline"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 pb-2 pt-1 font-medium text-sm"
                  >
                    Visual Contract Timeline
                  </TabsTrigger>
                  <TabsTrigger
                    value="allContracts"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 pb-2 pt-1 font-medium text-sm"
                  >
                    All Contracts ({selectedConsignee.allContracts.length})
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Overlapping Instances */}
                <TabsContent
                  value="overlaps"
                  className="mt-4 flex-1 overflow-y-auto min-h-0 pr-1 space-y-4"
                >
                  {selectedConsignee.overlappingInstances.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm border rounded-lg">
                      No overlapping contract instances detected for this
                      consignee.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedConsignee.overlappingInstances.map(
                        (instance, idx) => (
                          <div
                            key={idx}
                            className={`p-4 rounded-lg border shadow-xs flex flex-col gap-3 transition-colors ${
                              instance.isLowerPrice
                                ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800"
                                : "bg-card hover:border-amber-300"
                            }`}
                          >
                            <div className="flex items-center justify-between border-b pb-2 flex-wrap gap-2">
                              <span className="text-xs font-semibold flex items-center gap-1.5">
                                {instance.isLowerPrice ? (
                                  <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 rounded border border-rose-300">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    Overlap #{idx + 1}: Lower Price Contract (-₹
                                    {instance.priceDiff.toFixed(0)}/MT, -
                                    {instance.priceDiffPct.toFixed(1)}%)
                                  </span>
                                ) : (
                                  <span className="text-amber-700 font-semibold flex items-center gap-1">
                                    <ChartNoAxesGantt className="w-3.5 h-3.5" />
                                    Overlap #{idx + 1}
                                  </span>
                                )}
                              </span>
                              <span className="text-xs font-medium text-muted-foreground">
                                {instance.overlapDays} days overlap
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                              {/* Previous Contract */}
                              <div className="p-3 rounded bg-amber-500/5 border border-amber-500/20 flex flex-col gap-1.5">
                                <div className="font-semibold text-amber-800 flex justify-between">
                                  <span>
                                    Previous Contract #
                                    {instance.prevContract.contractNo}
                                  </span>
                                  <span>
                                    {instance.prevContract.invoiceCount}{" "}
                                    invoices
                                  </span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Contract Date:</span>
                                  <span>
                                    {instance.prevContract.contractDate ||
                                      "N/A"}
                                  </span>
                                </div>
                                <div className="flex justify-between font-medium">
                                  <span>Start Date (1st inv):</span>
                                  <span>{instance.prevContract.startDate}</span>
                                </div>
                                <div className="flex justify-between font-medium text-rose-700">
                                  <span>Completion Date (last inv):</span>
                                  <span>
                                    {instance.prevContract.completionDate}
                                  </span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Contract duration:</span>
                                  <span>
                                    {getContractDurationDays(
                                      instance.prevContract.contractDate,
                                      instance.prevContract.completionDate,
                                    )}
                                  </span>
                                </div>
                                <div className="flex justify-between font-bold text-foreground pt-1.5 border-t">
                                  <span>Unit Price (Basic Rate):</span>
                                  <span className="font-mono text-amber-900 dark:text-amber-300">
                                    ₹
                                    {instance.prevContract.avgPrice.toLocaleString(
                                      undefined,
                                      { maximumFractionDigits: 0 },
                                    )}{" "}
                                    / MT
                                  </span>
                                </div>
                                <div className="flex justify-between text-muted-foreground text-[11px]">
                                  <span>Total Qty:</span>
                                  <span className="font-mono">
                                    {instance.prevContract.totalQty.toFixed(0)}{" "}
                                    MT
                                  </span>
                                </div>
                              </div>

                              {/* Subsequent Contract */}
                              <div
                                className={`p-3 rounded border flex flex-col gap-1.5 ${
                                  instance.isLowerPrice
                                    ? "bg-rose-500/10 border-rose-500/30"
                                    : "bg-blue-500/5 border-blue-500/20"
                                }`}
                              >
                                <div
                                  className={`font-semibold flex justify-between ${instance.isLowerPrice ? "text-rose-800" : "text-blue-800"}`}
                                >
                                  <span>
                                    Subsequent Contract #
                                    {instance.subsequentContract.contractNo}
                                  </span>
                                  <span>
                                    {instance.subsequentContract.invoiceCount}{" "}
                                    invoices
                                  </span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Contract Date:</span>
                                  <span>
                                    {instance.subsequentContract.contractDate ||
                                      "N/A"}
                                  </span>
                                </div>
                                <div className="flex justify-between font-medium text-emerald-700">
                                  <span>Start Date (1st inv):</span>
                                  <span>
                                    {instance.subsequentContract.startDate}
                                  </span>
                                </div>
                                <div className="flex justify-between font-medium">
                                  <span>Completion Date (last inv):</span>
                                  <span>
                                    {instance.subsequentContract.completionDate}
                                  </span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Contract duration:</span>
                                  <span>
                                    {getContractDurationDays(
                                      instance.subsequentContract.contractDate,
                                      instance.subsequentContract
                                        .completionDate,
                                    )}
                                  </span>
                                </div>
                                <div className="flex justify-between font-bold text-foreground pt-1.5 border-t">
                                  <span>Unit Price (Basic Rate):</span>
                                  <span
                                    className={`font-mono ${instance.isLowerPrice ? "text-rose-700 font-extrabold" : "text-blue-900"}`}
                                  >
                                    ₹
                                    {instance.subsequentContract.avgPrice.toLocaleString(
                                      undefined,
                                      { maximumFractionDigits: 0 },
                                    )}{" "}
                                    / MT
                                  </span>
                                </div>
                                <div className="flex justify-between text-muted-foreground text-[11px]">
                                  <span>Total Qty:</span>
                                  <span className="font-mono">
                                    {instance.subsequentContract.totalQty.toFixed(
                                      0,
                                    )}{" "}
                                    MT
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* Tab 2: Visual Timeline */}
                <TabsContent
                  value="timeline"
                  className="mt-4 flex-1 flex flex-col min-h-0"
                >
                  <VisualTimeline consignee={selectedConsignee} />
                </TabsContent>

                {/* Tab 3: All Contracts */}
                <TabsContent
                  value="allContracts"
                  className="mt-4 flex-1 overflow-y-auto min-h-0"
                >
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50 font-semibold text-muted-foreground">
                          <th className="py-2.5 px-3">Contract No.</th>
                          <th className="py-2.5 px-3">Contract Date</th>
                          <th className="py-2.5 px-3">Start Date</th>
                          <th className="py-2.5 px-3">Completion Date</th>
                          <th className="py-2.5 px-3 text-right">
                            Unit Price (₹/MT)
                          </th>
                          <th className="py-2.5 px-3 text-center">Invoices</th>
                          <th className="py-2.5 px-3 text-right">
                            Total Qty (MT)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedConsignee.allContracts.map((c) => (
                          <tr key={c.contractNo} className="hover:bg-muted/30">
                            <td className="py-2.5 px-3 font-mono font-medium text-foreground">
                              #{c.contractNo}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {c.contractDate || "-"}
                            </td>
                            <td className="py-2.5 px-3 font-medium">
                              {c.startDate}
                            </td>
                            <td className="py-2.5 px-3 font-medium">
                              {c.completionDate}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold">
                              ₹
                              {c.avgPrice.toLocaleString(undefined, {
                                maximumFractionDigits: 0,
                              })}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono">
                              {c.invoiceCount}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              {c.totalQty.toFixed(0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

// Visual Timeline component to illustrate contract durations and overlaps
function VisualTimeline({ consignee }: { consignee: ConsigneeOverlapSummary }) {
  const contracts = consignee.allContracts;

  if (contracts.length === 0) return null;

  // Determine full time range
  const dates = contracts.flatMap((c) => [
    new Date(c.startDate).getTime(),
    new Date(c.completionDate).getTime(),
  ]);
  const minTime = Math.min(...dates);
  const maxTime = Math.max(...dates);
  const totalDuration = Math.max(1, maxTime - minTime);

  // Identify contract IDs involved in lower price vs normal overlaps
  const suspiciousContractNos = new Set<string>();
  const overlapContractNos = new Set<string>();

  consignee.overlappingInstances.forEach((inst) => {
    if (inst.isLowerPrice) {
      suspiciousContractNos.add(inst.prevContract.contractNo);
      suspiciousContractNos.add(inst.subsequentContract.contractNo);
    } else {
      overlapContractNos.add(inst.prevContract.contractNo);
      overlapContractNos.add(inst.subsequentContract.contractNo);
    }
  });

  return (
    <div className="border rounded-xl p-4 bg-background flex flex-col gap-3 flex-1 min-h-0 h-full">
      <div className="flex items-center justify-between text-xs text-muted-foreground border-b pb-2 shrink-0">
        <span>
          Earliest Start: <strong>{contracts[0].startDate}</strong>
        </span>
        <span>
          Latest Completion:{" "}
          <strong>{contracts[contracts.length - 1].completionDate}</strong>
        </span>
      </div>

      <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto pr-1">
        {contracts.map((contract) => {
          const startTime = new Date(contract.startDate).getTime();
          const endTime = new Date(contract.completionDate).getTime();

          const leftPct = Math.max(
            0,
            Math.min(100, ((startTime - minTime) / totalDuration) * 100),
          );
          const widthPct = Math.max(
            2,
            Math.min(
              100 - leftPct,
              ((endTime - startTime || 1000 * 60 * 60 * 24) / totalDuration) *
                100,
            ),
          );

          const isSuspicious = suspiciousContractNos.has(contract.contractNo);
          const isOverlapping = overlapContractNos.has(contract.contractNo);

          return (
            <div
              key={contract.contractNo}
              className="flex flex-col gap-1 text-xs p-2 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center justify-between text-[11px] gap-2 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-bold text-foreground text-xs">
                    #{contract.contractNo}
                  </span>
                  {isSuspicious ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">
                      Flagged
                    </span>
                  ) : isOverlapping ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-800">
                      Overlapping
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-auto font-mono text-[11px]">
                  <span
                    className="bg-background border px-2 py-0.5 rounded text-muted-foreground w-44 text-center"
                    title="Duration"
                  >
                    {contract.startDate} → {contract.completionDate}
                  </span>
                  <span
                    className="bg-background border px-2 py-0.5 rounded font-semibold text-foreground w-28 text-right"
                    title="Unit Price"
                  >
                    ₹
                    {contract.avgPrice.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}{" "}
                    / MT
                  </span>
                  <span
                    className="bg-background border px-2 py-0.5 rounded text-muted-foreground w-20 text-right"
                    title="Total Quantity"
                  >
                    {contract.totalQty.toFixed(0)} MT
                  </span>
                </div>
              </div>

              <div className="w-full bg-muted/60 h-5 rounded relative overflow-hidden flex items-center">
                <div
                  className={`h-full rounded transition-all flex items-center px-2 text-[10px] font-bold text-white shadow-xs ${
                    isSuspicious
                      ? "bg-gradient-to-r from-rose-600 to-red-500"
                      : isOverlapping
                        ? "bg-gradient-to-r from-amber-500 to-orange-500"
                        : "bg-gradient-to-r from-blue-500 to-indigo-500"
                  }`}
                  style={{
                    marginLeft: `${leftPct}%`,
                    width: `${widthPct}%`,
                  }}
                  title={`Contract #${contract.contractNo}: ${contract.startDate} to ${contract.completionDate} (₹${contract.avgPrice.toFixed(0)}/MT)`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
