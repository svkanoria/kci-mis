"use client";

import { useMemo, useState, use } from "react";
import {
  ModuleRegistry,
  SortChangedEvent,
  ICellRendererParams,
} from "ag-grid-community";
import {
  AllEnterpriseModule,
  LicenseManager,
  ColDef,
  GridApi,
} from "ag-grid-enterprise";
import { AgGridReact } from "ag-grid-react";
import { getDistributionPattern } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { formatIndianNumber } from "@/lib/utils/format";

// Register License Key with LicenseManager
LicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_GRID_LICENSE || "");

ModuleRegistry.registerModules([AllEnterpriseModule]);

type ResponseType = Awaited<ReturnType<typeof getDistributionPattern>>;
type IRow = ResponseType[number];

const lsKey = (key: string) => `distribution-pattern-${key}`;
const GRID_SORT_KEY = lsKey("sort");

const ChannelWithRecipientRenderer = (params: ICellRendererParams<IRow>) => {
  const channel = params.value;

  if (!params.data) {
    return <span>{channel}</span>;
  }

  const isPrev = params.colDef?.field === "prevDistChannelDescription";
  const recipientName = isPrev
    ? params.data.prevRecipientName
    : params.data.recipientName;

  if (!recipientName) {
    return <span>{channel}</span>;
  }

  return (
    <div className="flex flex-col justify-center h-full w-full pr-1 pt-1.25">
      <span className="truncate leading-tight font-medium" title={channel}>
        {channel}
      </span>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground w-full -mt-0.5">
        <span className="truncate" title={recipientName}>
          {recipientName}
        </span>
      </div>
    </div>
  );
};

export const DataGrid = ({ data }: { data: Promise<ResponseType> }) => {
  const rows = use(data);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [quickFilterText, setQuickFilterText] = useState("");

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
    };
  }, []);

  const colDefs = useMemo<ColDef<IRow>[]>(() => {
    return [
      {
        field: "consigneeName",
        headerName: "Customer Name",
        tooltipField: "consigneeName",
        width: 300,
        filter: "agTextColumnFilter",
        cellRenderer: "agGroupCellRenderer",
      },
      {
        field: "invDate",
        headerName: "Invoice Date",
        width: 150,
        filter: "agDateColumnFilter",
        sort: "desc",
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
        field: "distChannelDescription",
        headerName: "New Channel",
        width: 160,
        filter: "agSetColumnFilter",
        cellRenderer: ChannelWithRecipientRenderer,
      },
      {
        field: "prevDistChannelDescription",
        headerName: "Previous Channel",
        width: 160,
        filter: "agSetColumnFilter",
        cellRenderer: ChannelWithRecipientRenderer,
      },
      {
        field: "avgQtyL6M",
        headerName: "Avg Monthly Qty (Last 6M)",
        width: 125,
        type: "numericColumn",
        filter: "agNumberColumnFilter",
        valueFormatter: (params) => formatIndianNumber(params.value),
      },
      {
        field: "switchCount",
        headerName: "# Switches",
        width: 100,
        type: "numericColumn",
        filter: "agNumberColumnFilter",
      },
      {
        field: "invCount",
        headerName: "# Invoices",
        width: 100,
        type: "numericColumn",
        filter: "agNumberColumnFilter",
      },
    ];
  }, []);

  const detailCellRendererParams = useMemo(() => {
    return {
      detailGridOptions: {
        rowHeight: 47,
        columnDefs: [
          {
            field: "invDate",
            headerName: "Invoice Date",
            width: 150,
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
            field: "distChannelDescription",
            headerName: "New Channel",
            width: 220,
            cellRenderer: ChannelWithRecipientRenderer,
          },
          {
            field: "prevDistChannelDescription",
            headerName: "Previous Channel",
            width: 220,
            cellRenderer: ChannelWithRecipientRenderer,
          },
        ],
      },
      getDetailRowData: (params: any) => {
        params.successCallback(params.data.history || []);
      },
    };
  }, []);

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
          isRowMaster={(dataItem) => dataItem.history?.length}
          detailCellRendererParams={detailCellRendererParams}
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
