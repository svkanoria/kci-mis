"use client";

import { useMemo, useState, useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { LatLngBoundsExpression } from "leaflet";
import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import { Button } from "@/components/ui/button";
import { ExternalLink, ChevronLeft, Sliders, MapPin, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { ConsigneeSalesPoint } from "@/lib/api/sales-by-consignee";
import { formatDate } from "@/lib/utils/date";
import { formatIndianNumber } from "@/lib/utils/format";
import { plantCoords, plantColors } from "@/lib/constants";
import { Cluster } from "@/lib/utils/milp-cluster";

// Centralized colors configuration matching Tailwind CSS theme
interface ClusterStyle {
  circleColor: string;
  circleFillOpacity: number;
  markerColor: string;
  markerFillOpacity: number;
  
  cardBgClass: string;
  badgeBgClass: string;
  volumeTextClass: string;
  indicatorBgClass: string;
}

// Derives cluster colors dynamically based on density and selection
function getClusterStyle(isDense: boolean, isSelected: boolean): ClusterStyle {
  if (isDense) {
    return {
      circleColor: "var(--color-pink-400)",
      circleFillOpacity: isSelected ? 0.28 : 0.20,
      markerColor: "var(--color-pink-600)",
      markerFillOpacity: 0.7,
      
      cardBgClass: "bg-pink-50/20 border-pink-200 hover:bg-pink-50 hover:border-pink-300",
      badgeBgClass: "bg-pink-100 text-pink-800",
      volumeTextClass: "text-pink-700",
      indicatorBgClass: "bg-pink-500",
    };
  } else {
    return {
      circleColor: "var(--color-slate-500)",
      circleFillOpacity: isSelected ? 0.28 : 0.23,
      markerColor: "var(--color-slate-700)",
      markerFillOpacity: 0.4,
      
      cardBgClass: "bg-gray-50/10 border-gray-200 hover:bg-gray-50 hover:border-gray-300",
      badgeBgClass: "bg-gray-100 text-gray-800",
      volumeTextClass: "text-gray-700",
      indicatorBgClass: "bg-gray-500",
    };
  }
}

// Helper component to establish a custom high z-index pane for consignee markers (above popupPane at 700)
const ConsigneePaneSetup = () => {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane("consigneePane")) {
      const pane = map.createPane("consigneePane");
      pane.style.zIndex = "800"; // Higher than Leaflet popupPane (700)
    }
  }, [map]);
  return null;
};



const RADIUS_KM = 100; // Fixed radius of 100 km for distribution hub identification

export const Map = ({
  salesPoints,
  from,
  to,
  product,
}: {
  salesPoints: ConsigneeSalesPoint[];
  from?: Date;
  to?: Date;
  product?: string;
}) => {
  const [minDensityQty, setMinDensityQty] = useState<number>(100);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [hoveredConsigneeId, setHoveredConsigneeId] = useState<number | string | null>(null);

  // Compute number of months in the date range
  const numMonths = useMemo(() => {
    if (!from || !to) return 1;
    const diffYear = to.getFullYear() - from.getFullYear();
    const diffMonth = to.getMonth() - from.getMonth();
    return Math.max(1, diffYear * 12 + diffMonth + 1);
  }, [from, to]);

  const [computedClusters, setComputedClusters] = useState<Cluster[]>([]);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  // Reset selected cluster and minDensityQty if sales points change (data refetched)
  useEffect(() => {
    setSelectedClusterId(null);
    setMinDensityQty(100);
    setHoveredConsigneeId(null);
  }, [salesPoints]);

  // Compute clusters asynchronously in Web Worker thread using MILP Facility Location optimization
  useEffect(() => {
    if (salesPoints.length === 0) {
      setComputedClusters([]);
      setIsCalculating(false);
      return;
    }

    setIsCalculating(true);

    const worker = new Worker(
      new URL("./clusterWorker.ts", import.meta.url)
    );

    worker.onmessage = (event: MessageEvent<{ clusters: Cluster[] }>) => {
      setComputedClusters(event.data.clusters);
      setIsCalculating(false);
      worker.terminate();
    };

    worker.onerror = (error) => {
      console.error("Cluster Worker Error:", error);
      setIsCalculating(false);
      worker.terminate();
    };

    worker.postMessage({
      salesPoints,
      radiusKm: RADIUS_KM,
      numMonths,
    });

    return () => {
      worker.terminate();
    };
  }, [salesPoints, numMonths]);

  // Map clusters with dynamic density highlight evaluation and sort descending
  const sortedClusters = useMemo(() => {
    return [...computedClusters]
      .map((c) => ({
        ...c,
        isDense: c.avgMonthlyQty >= minDensityQty,
      }))
      .sort((a, b) => b.avgMonthlyQty - a.avgMonthlyQty);
  }, [computedClusters, minDensityQty]);

  // Auto-scale the slider maximum based on maximum average monthly quantity in clusters
  const sliderMax = useMemo(() => {
    if (computedClusters.length === 0) return 500;
    const maxVal = Math.max(...computedClusters.map((c) => c.avgMonthlyQty), 10);
    return Math.ceil(maxVal);
  }, [computedClusters]);

  // Dynamic step size for range input
  const sliderStep = useMemo(() => {
    if (sliderMax <= 10) return 0.5;
    if (sliderMax <= 50) return 1;
    if (sliderMax <= 500) return 5;
    return 10;
  }, [sliderMax]);

  // Find currently selected cluster with dynamic density highlight
  const selectedCluster = useMemo(() => {
    if (!selectedClusterId) return null;
    const base = computedClusters.find((c) => c.id === selectedClusterId);
    if (!base) return null;
    return {
      ...base,
      isDense: base.avgMonthlyQty >= minDensityQty,
    };
  }, [computedClusters, selectedClusterId, minDensityQty]);

  const maxClusterQty = useMemo(() => {
    return Math.max(...computedClusters.map((c) => c.totalQty), 1);
  }, [computedClusters]);

  // Generate URL for top-customers report filtered by consignee, product, date range
  const getDetailsUrl = (consigneeName: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", formatDate(from));
    if (to) params.set("to", formatDate(to));
    if (product) params.set("product", product);

    params.set("grouping", "none");
    params.set("consignee", consigneeName);

    return `/top-customers?${params.toString()}`;
  };

  return (
    <div className="flex h-full w-full">
      {/* Map Panel */}
      <div className="grow h-full relative z-0">
        <MapContainer
          center={[20.5937, 78.9629]} // Center of India
          zoom={5}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Plot KCI Plants for reference */}
          {Object.entries(plantCoords).map(([plantIdStr, coords]) => {
            const plantId = Number(plantIdStr);
            const color = plantColors[plantId] || "black";
            return (
              <CircleMarker
                key={`plant-${plantId}`}
                center={[coords.latitude, coords.longitude]}
                pathOptions={{
                  color: "var(--color-slate-800)",
                  fillColor: color,
                  fillOpacity: 1,
                  weight: 2,
                }}
                radius={8}
              >
                <Tooltip sticky>
                  <div className="text-xs font-bold font-sans">
                    KCI Plant {plantId}
                  </div>
                </Tooltip>
                <Popup>
                  <div className="text-xs font-semibold">
                    KCI Production Facility {plantId}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* Pass 1: Plot all Cluster 100 km Coverage Circles in the background */}
          {sortedClusters.map((cluster) => {
            const isSelected = selectedClusterId === cluster.id;
            const styles = getClusterStyle(cluster.isDense, isSelected);

            return (
              <Circle
                key={`circle-${cluster.id}`}
                center={[cluster.center.lat, cluster.center.lng]}
                radius={RADIUS_KM * 1000} // React-Leaflet takes radius in meters
                pathOptions={{
                  color: isSelected ? "var(--color-slate-600)" : "var(--color-slate-400)",
                  fillColor: styles.circleColor,
                  fillOpacity: styles.circleFillOpacity,
                  weight: isSelected ? 2 : 1.5,
                  dashArray: cluster.isDense ? "" : "3, 6",
                  interactive: false,
                }}
              />
            );
          })}

          {/* Pass 2: Plot all Cluster Markers on top of all circles so all markers are clickable */}
          {sortedClusters.map((cluster) => {
            const isSelected = selectedClusterId === cluster.id;
            const markerRadius = Math.max(
              6,
              Math.min(24, 6 + (cluster.totalQty / maxClusterQty) * 18)
            );

            const styles = getClusterStyle(cluster.isDense, isSelected);

            return (
              <CircleMarker
                key={`marker-${cluster.id}`}
                center={[cluster.center.lat, cluster.center.lng]}
                radius={markerRadius}
                pathOptions={{
                  color: isSelected ? "var(--color-slate-800)" : "var(--color-slate-600)",
                  fillColor: styles.markerColor,
                  fillOpacity: styles.markerFillOpacity,
                  weight: isSelected ? 3 : 1.5,
                }}
                eventHandlers={{
                  click: () => {
                    setSelectedClusterId(
                      cluster.id === selectedClusterId ? null : cluster.id
                    );
                  },
                }}
              >
                <Popup
                  eventHandlers={{
                    remove: () => {
                      if (selectedClusterId === cluster.id) {
                        setSelectedClusterId(null);
                      }
                    },
                  }}
                >
                  <div className="text-sm">
                    <div className="font-bold text-gray-900 mb-1">
                      Hub Center: {cluster.hubName}
                    </div>
                    <div className="text-gray-700 leading-normal">
                      Monthly Avg:{" "}
                      <span className="font-semibold text-pink-600">
                        {formatIndianNumber(cluster.avgMonthlyQty)} MT/mo
                      </span>
                    </div>
                    <div className="text-gray-600 text-[10px] mt-0.5">
                      Total Volume: {formatIndianNumber(cluster.totalQty)} MT | Consignees: {cluster.points.length}
                    </div>
                    <div className="mt-1.5">
                      {cluster.isDense ? (
                        <span className="inline-block bg-pink-100 text-pink-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          Dense Hub Candidate
                        </span>
                      ) : (
                        <span className="inline-block bg-gray-100 text-gray-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          Below Threshold
                        </span>
                      )}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          <ConsigneePaneSetup />

          {/* Pass 3: Plot Consignees as Dots for Activated/Selected Cluster */}
          {selectedCluster &&
            selectedCluster.points.map((point, idx) => {
              const isHovered = hoveredConsigneeId === point.consigneeId;
              return (
                <CircleMarker
                  key={`selected-point-${point.consigneeId}-${point.city}-${idx}`}
                  center={[point.lat, point.lng]}
                  radius={isHovered ? 8.5 : 4.5}
                  pane="consigneePane"
                  pathOptions={{
                    color: isHovered ? "#44ef4aff" : "var(--color-indigo-900)",
                    fillColor: "var(--color-indigo-600)",
                    fillOpacity: isHovered ? 1 : 0.85,
                    weight: isHovered ? 5.5 : 1.5,
                  }}
                />
              );
            })}
        </MapContainer>
      </div>

      {/* Side Panel */}
      <div className="w-96 h-full border-l bg-white overflow-hidden flex flex-col shadow-xl z-10">
        {/* Controls Header */}
        <div className="p-4 border-b bg-gray-50 flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between font-semibold text-gray-900 text-lg">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-gray-500" />
              Hub Discovery Parameters
            </div>
            {isCalculating && (
              <span className="text-xs font-semibold text-pink-600 bg-pink-50 px-2 py-0.5 rounded border border-pink-200 animate-pulse">
                Optimizing...
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs font-semibold text-gray-600">
                <span>Min Monthly Volume</span>
                <span className="text-pink-600 font-bold">
                  {minDensityQty} MT/month
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="range"
                  min="0"
                  max={sliderMax}
                  step={sliderStep}
                  value={minDensityQty}
                  onChange={(e) => setMinDensityQty(Number(e.target.value))}
                  className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-600"
                />
                <input
                  type="number"
                  min="0"
                  max={sliderMax}
                  value={minDensityQty}
                  onChange={(e) =>
                    setMinDensityQty(Math.max(0, Number(e.target.value)))
                  }
                  className="w-16 border rounded text-xs p-1 text-center font-semibold text-gray-700 bg-white"
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>0 MT</span>
                <span>{sliderMax} MT</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto">
          {!selectedCluster ? (
            // Full Cluster List View
            <div className="p-4 space-y-3">
              <h3 className="font-bold text-sm mb-2 uppercase tracking-wider text-gray-500">
                Discovered Areas ({sortedClusters.length})
              </h3>
              {sortedClusters.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  No sales data found matching criteria.
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedClusters.map((cluster, idx) => {
                    const styles = getClusterStyle(cluster.isDense, false);
                    return (
                      <div
                        key={cluster.id}
                        onClick={() => setSelectedClusterId(cluster.id)}
                        className={`p-3 border rounded-lg cursor-pointer transition-all flex justify-between items-center ${styles.cardBgClass}`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center justify-center text-xs font-bold w-5 h-5 rounded-full shrink-0 ${styles.badgeBgClass}`}
                            >
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-sm text-gray-900 truncate">
                              {cluster.hubName.split(",")[0]}
                            </span>
                            {cluster.isDense && (
                              <span className={`inline-block text-[9px] ${styles.indicatorBgClass} text-white font-bold px-1 rounded-sm shrink-0 uppercase tracking-tight scale-90`}>
                                Hub
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 pl-6 mt-0.5">
                            {cluster.points.length} consignees
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`font-bold text-sm ${styles.volumeTextClass}`}>
                            {formatIndianNumber(cluster.avgMonthlyQty)}
                          </div>
                          <div className="text-[10px] text-gray-400">MT/month</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            // Selected Cluster Consignee Detail View
            <div className="flex flex-col h-full animate-fadeIn">
              <div className="p-3 border-b bg-slate-50/50 flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 rounded-full animate-transition"
                  onClick={() => setSelectedClusterId(null)}
                >
                  <ChevronLeft className="w-5 h-5 text-gray-700" />
                </Button>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                    Area Details ({RADIUS_KM} km radius)
                  </div>
                  <div className="font-bold text-gray-900 text-sm truncate">
                    Cluster Center: {selectedCluster.hubName}
                  </div>
                </div>
              </div>

              <div className="p-4 border-b bg-gray-50/50 flex flex-col gap-3 shrink-0 font-sans">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-gray-400 leading-tight">
                      Monthly Average
                    </div>
                    <div className="text-lg font-extrabold text-pink-600">
                      {formatIndianNumber(selectedCluster.avgMonthlyQty)}{" "}
                      <span className="text-xs font-medium text-gray-500">MT/mo</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-gray-400 leading-tight">
                      Total Volume
                    </div>
                    <div className="text-sm font-bold text-slate-800">
                      {formatIndianNumber(selectedCluster.totalQty)} <span className="text-xs font-medium text-gray-500">MT</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs border-t pt-2 mt-1">
                  <span className="text-gray-500">Consignees: {selectedCluster.points.length}</span>
                  {selectedCluster.isDense ? (
                    <span className="bg-pink-100 text-pink-800 text-[10px] font-bold px-2 py-0.5 rounded">
                      Dense Cluster
                    </span>
                  ) : (
                    <span className="bg-gray-100 text-gray-800 text-[10px] font-bold px-2 py-0.5 rounded">
                      Below Threshold
                    </span>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">
                        Customer
                      </th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600">
                        Qty (MT)
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-600 w-12">
                        Link
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedCluster.points
                      .sort((a, b) => b.totalQty - a.totalQty)
                      .map((point, idx) => {
                        const isHovered = hoveredConsigneeId === point.consigneeId;
                        return (
                          <tr
                            key={`${point.consigneeId}-${point.city}-${idx}`}
                            onMouseEnter={() => setHoveredConsigneeId(point.consigneeId)}
                            onMouseLeave={() => setHoveredConsigneeId(null)}
                            className={`transition-colors cursor-pointer ${
                              isHovered
                                ? "bg-red-50/80"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            <td className="px-3 py-2 min-w-0">
                              <div className={`break-words max-w-[180px] ${isHovered ? "text-red-900 font-bold" : "font-semibold text-gray-800"}`}>
                                {point.consigneeName}
                              </div>
                              <div className="text-[10px] text-gray-500">
                                {point.city}, {point.region}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-900">
                              {formatIndianNumber(point.totalQty)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Link
                                href={getDetailsUrl(point.consigneeName)}
                                target="_blank"
                                className="inline-flex items-center justify-center p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
