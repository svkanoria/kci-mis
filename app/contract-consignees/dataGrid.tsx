"use client";

import { useMemo, useState, use, useCallback } from "react";
import { ModuleRegistry, SortChangedEvent } from "ag-grid-community";
import {
  AllEnterpriseModule,
  LicenseManager,
  ColDef,
  GridApi,
} from "ag-grid-enterprise";
import { AgGridReact } from "ag-grid-react";
import {
  getContractConsignees,
  Contract,
  Consignee,
  ConsigneePriceAnalysisResult,
} from "@/lib/api";
import { getConsigneePriceAnalysisAction } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatIndianNumber } from "@/lib/utils/format";
import { parseISO, format } from "date-fns";
import { BarChart3, Loader2 } from "lucide-react";

// Register License Key with LicenseManager
LicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_GRID_LICENSE || "");

ModuleRegistry.registerModules([AllEnterpriseModule]);

type ResponseType = Awaited<ReturnType<typeof getContractConsignees>>;

const lsKey = (key: string) => `contract-consignees-${key}`;
const GRID_SORT_KEY = lsKey("sort");

export const DataGrid = ({
  data,
  product,
}: {
  data: Promise<ResponseType>;
  product?: string;
}) => {
  const rows = use(data);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [quickFilterText, setQuickFilterText] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisResult, setAnalysisResult] =
    useState<ConsigneePriceAnalysisResult | null>(null);
  const [selectedConsignee, setSelectedConsignee] = useState<Consignee | null>(
    null,
  );

  const handleAnalyse = useCallback(
    async (consignee: Consignee) => {
      if (!consignee.firstInvDate || !consignee.lastInvDate) {
        alert("No invoice dates available for this consignee.");
        return;
      }
      setSelectedConsignee(consignee);
      setIsDialogOpen(true);
      setLoadingAnalysis(true);
      setAnalysisResult(null);

      try {
        const res = await getConsigneePriceAnalysisAction({
          city: consignee.consigneeCity,
          region: consignee.consigneeRegion,
          firstInvDate: consignee.firstInvDate,
          lastInvDate: consignee.lastInvDate,
          product,
          clickedConsigneeName: consignee.consigneeName,
        });
        setAnalysisResult(res);
      } catch (err) {
        console.error("Error fetching price analysis:", err);
      } finally {
        setLoadingAnalysis(false);
      }
    },
    [product],
  );

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

  const autoGroupColumnDef = useMemo<ColDef>(() => {
    return {
      headerName: "Group",
      width: 250,
      pinned: "left",
    };
  }, []);

  const colDefs = useMemo<ColDef<Contract>[]>(() => {
    return [
      {
        field: "contractNo",
        headerName: "Contract No.",
        width: 170,
        filter: "agTextColumnFilter",
        cellRenderer: "agGroupCellRenderer",
      },
      {
        field: "contractDate",
        headerName: "Contract Date",
        width: 140,
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
        field: "recipientName",
        headerName: "Recipient Name",
        width: 240,
        filter: "agTextColumnFilter",
        tooltipField: "recipientName",
        enableRowGroup: true,
      },
      {
        headerName: "# Consignees",
        width: 130,
        type: "numericColumn",
        filter: "agNumberColumnFilter",
        valueGetter: (params) => {
          if (params.node?.group) {
            const children = params.node.childrenAfterGroup;
            if (!children || children.length === 0) return 0;
            const totalConsignees = children.reduce(
              (sum: number, child: any) =>
                sum + (child.data?.consignees?.length ?? 0),
              0,
            );
            return totalConsignees / children.length;
          }
          return params.data?.consignees?.length ?? 0;
        },
        valueFormatter: (params) => {
          if (params.node?.group) {
            return params.value != null ? Number(params.value).toFixed(1) : "";
          }
          return params.value != null ? String(params.value) : "";
        },
        sort: "desc",
        sortIndex: 0,
      },
      {
        field: "totalQty",
        headerName: "Total Qty (MT)",
        width: 140,
        type: "numericColumn",
        filter: "agNumberColumnFilter",
        aggFunc: "sum",
        valueFormatter: (params) => formatIndianNumber(params.value),
      },
      {
        field: "totalBasicAmount",
        headerName: "Total Basic Amt (₹)",
        width: 160,
        type: "numericColumn",
        filter: "agNumberColumnFilter",
        aggFunc: "sum",
        valueFormatter: (params) => formatIndianNumber(params.value),
      },
      {
        field: "avgBasicPrice",
        headerName: "Avg Basic Rate (₹/MT)",
        width: 170,
        type: "numericColumn",
        filter: "agNumberColumnFilter",
        valueGetter: (params) => {
          if (params.node?.group && params.node.aggData) {
            const totalAmt = params.node.aggData.totalBasicAmount ?? 0;
            const totalQty = params.node.aggData.totalQty ?? 0;
            return totalQty > 0 ? totalAmt / totalQty : 0;
          }
          return params.data?.avgBasicPrice;
        },
        valueFormatter: (params) => formatIndianNumber(params.value),
      },
      {
        field: "firstInvDate",
        headerName: "First Inv Date",
        width: 140,
        filter: "agDateColumnFilter",
        valueGetter: (params) => {
          if (params.node?.group) {
            let minDate: string | null = null;
            params.node.allLeafChildren?.forEach((child: any) => {
              if (
                child.data?.firstInvDate &&
                (!minDate || child.data.firstInvDate < minDate)
              ) {
                minDate = child.data.firstInvDate;
              }
            });
            return minDate;
          }
          return params.data?.firstInvDate;
        },
        valueFormatter: (params) => {
          if (!params.value) return "";
          return new Date(params.value).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
        },
        sort: "desc",
        sortIndex: 1,
      },
      {
        field: "lastInvDate",
        headerName: "Last Inv Date",
        width: 140,
        filter: "agDateColumnFilter",
        valueGetter: (params) => {
          if (params.node?.group) {
            let maxDate: string | null = null;
            params.node.allLeafChildren?.forEach((child: any) => {
              if (
                child.data?.lastInvDate &&
                (!maxDate || child.data.lastInvDate > maxDate)
              ) {
                maxDate = child.data.lastInvDate;
              }
            });
            return maxDate;
          }
          return params.data?.lastInvDate;
        },
        valueFormatter: (params) => {
          if (!params.value) return "";
          return new Date(params.value).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
        },
      },
    ];
  }, []);

  const detailCellRendererParams = useMemo(() => {
    return {
      detailGridOptions: {
        rowHeight: 40,
        headerHeight: 40,
        columnDefs: [
          {
            field: "consigneeName",
            headerName: "Consignee Name",
            width: 240,
            filter: "agTextColumnFilter",
            tooltipField: "consigneeName",
          },
          {
            field: "consigneeCity",
            headerName: "City",
            width: 150,
            filter: "agTextColumnFilter",
          },
          {
            field: "consigneeRegion",
            headerName: "Region",
            width: 150,
            filter: "agTextColumnFilter",
          },
          {
            field: "totalQty",
            headerName: "Qty (MT)",
            width: 130,
            type: "numericColumn",
            filter: "agNumberColumnFilter",
            valueFormatter: (params: any) => formatIndianNumber(params.value),
          },
          {
            field: "totalBasicAmount",
            headerName: "Basic Amount (₹)",
            width: 160,
            type: "numericColumn",
            filter: "agNumberColumnFilter",
            valueFormatter: (params: any) => formatIndianNumber(params.value),
          },
          {
            field: "avgBasicPrice",
            headerName: "Avg Basic Rate (₹/MT)",
            width: 170,
            type: "numericColumn",
            filter: "agNumberColumnFilter",
            valueFormatter: (params: any) => formatIndianNumber(params.value),
          },
          {
            field: "firstInvDate",
            headerName: "First Inv Date",
            width: 140,
            filter: "agDateColumnFilter",
            valueFormatter: (params: any) => {
              if (!params.value) return "";
              return new Date(params.value).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              });
            },
          },
          {
            field: "lastInvDate",
            headerName: "Last Inv Date",
            width: 140,
            filter: "agDateColumnFilter",
            valueFormatter: (params: any) => {
              if (!params.value) return "";
              return new Date(params.value).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              });
            },
          },
          {
            headerName: "Analyse",
            width: 110,
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
                  className="h-7 px-2 text-xs font-medium"
                  onClick={() => handleAnalyse(params.data)}
                >
                  Analyse
                </Button>
              );
            },
          },
        ],
      },
      getDetailRowData: (params: any) => {
        params.successCallback(params.data.consignees || []);
      },
    };
  }, [handleAnalyse]);

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
          masterDetail={true}
          isRowMaster={(dataItem) =>
            Boolean(dataItem?.consignees && dataItem.consignees.length > 0)
          }
          detailCellRendererParams={detailCellRendererParams}
          quickFilterText={quickFilterText}
          rowData={rows}
          columnDefs={colDefs}
          defaultColDef={defaultColDef}
          autoGroupColumnDef={autoGroupColumnDef}
          rowGroupPanelShow="always"
          groupDisplayType="multipleColumns"
          suppressAggFuncInHeader
          headerHeight={48}
          rowHeight={45}
          pagination
          enableBrowserTooltips
          onGridReady={onGridReady}
          onSortChanged={onSortChanged}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] w-full flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <BarChart3 className="h-5 w-5 text-primary" />
              Consignee Price Analysis ({selectedConsignee?.consigneeCity},{" "}
              {selectedConsignee?.consigneeRegion})
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Comparing prices across customers in{" "}
              {selectedConsignee?.consigneeCity},{" "}
              {selectedConsignee?.consigneeRegion}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {loadingAnalysis ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Loading price comparison data...
              </div>
            ) : !analysisResult ||
              analysisResult.dates.length === 0 ||
              analysisResult.consignees.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                No price data found for {selectedConsignee?.consigneeCity},{" "}
                {selectedConsignee?.consigneeRegion} in this date range.
              </div>
            ) : (
              <div className="relative border rounded-lg overflow-auto max-h-[65vh]">
                <table className="w-full text-xs text-left border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="sticky top-0 left-0 z-30 bg-muted px-3 py-2 border-b border-r font-semibold whitespace-nowrap min-w-[200px]">
                        Consignee Name
                      </th>
                      <th className="sticky top-0 z-20 bg-muted px-3 py-2 border-b border-r text-right font-semibold whitespace-nowrap min-w-[110px]">
                        Avg Rate (₹/MT)
                      </th>
                      {analysisResult.dates.map((d) => {
                        const isCoreDate =
                          d >= analysisResult.firstInvDate &&
                          d <= analysisResult.lastInvDate;

                        return (
                          <th
                            key={d}
                            className={`sticky top-0 z-20 px-3 py-2 border-b border-r text-right font-semibold whitespace-nowrap min-w-[90px] ${
                              isCoreDate
                                ? "bg-[color-mix(in_srgb,var(--primary)_20%,var(--muted))] text-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {format(parseISO(d), "dd MMM yyyy")}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {analysisResult.consignees.map((row) => {
                      const isSelected =
                        row.consigneeName === selectedConsignee?.consigneeName;
                      const rowBgClass = isSelected
                        ? "bg-primary/10 hover:bg-primary/15 font-medium"
                        : "hover:bg-muted/50";
                      const stickyBgClass = isSelected
                        ? "bg-[color-mix(in_srgb,var(--primary)_15%,var(--background))]"
                        : "bg-background group-hover:bg-[color-mix(in_srgb,var(--muted)_50%,var(--background))]";

                      return (
                        <tr
                          key={row.consigneeName}
                          className={`group ${rowBgClass}`}
                        >
                          <td
                            className={`sticky left-0 z-10 px-3 py-2 border-b border-r whitespace-nowrap ${stickyBgClass}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span>{row.consigneeName}</span>
                              {isSelected && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/20 text-primary border border-primary/30">
                                  Selected
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 border-b border-r text-right font-mono font-medium whitespace-nowrap">
                            {formatIndianNumber(row.avgPrice)}
                          </td>
                          {analysisResult.dates.map((d) => {
                            const isCoreDate =
                              d >= analysisResult.firstInvDate &&
                              d <= analysisResult.lastInvDate;
                            const val = row.prices[d];

                            return (
                              <td
                                key={d}
                                className={`px-3 py-2 border-b border-r text-right font-mono whitespace-nowrap ${
                                  isCoreDate ? "bg-primary/5" : ""
                                } ${
                                  val != null
                                    ? "text-foreground font-medium"
                                    : "text-muted-foreground/40"
                                }`}
                              >
                                {val != null ? formatIndianNumber(val) : "-"}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
