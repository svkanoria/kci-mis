"use client";

import { useMemo, useState, useEffect } from "react";
import { plantCoords } from "@/lib/constants";
import { formatDate } from "@/lib/utils/date"; // Import formatDate
import "leaflet/dist/leaflet.css";
import { divIcon, LatLngBoundsExpression } from "leaflet";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import { getSalesByRouteFD } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { TimeDirectionButton } from "../_components/timeDirectionButton";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

type Route = Awaited<ReturnType<typeof getSalesByRouteFD>>[number];

const lsKey = (key: string) => `route-map-fd-${key}`;
const HEATMAP_MODE_KEY = lsKey("heatmapMode");

const RouteHistoryChart = ({
  history,
}: {
  history: { date: string; qty: number }[];
}) => {
  if (!history || history.length === 0) return null;

  const width = 240; // Increased width for axis
  const height = 100;
  const padding = 5;
  const rightAxisWidth = 35;
  const barGap = 2;

  const maxQty = Math.max(...history.map((h) => h.qty), 1);
  const avgQty =
    history.reduce((sum, h) => sum + h.qty, 0) / history.length || 0;

  const chartWidth = width - rightAxisWidth - padding * 2;
  const barWidth = chartWidth / history.length - barGap;

  // Coordinate calculations
  // Y axis is inverted in SVG (0 is top)
  const getY = (val: number) =>
    height - padding - (val / maxQty) * (height - padding * 2);

  const avgY = getY(avgQty);

  const minDate = new Date(history[0].date);
  const maxDate = new Date(history[history.length - 1].date);
  const dateFormatter = new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
  });

  return (
    <div className="mt-2">
      <div className="text-xs text-gray-500 mb-1">
        History (Avg: {Math.round(avgQty)} MT)
      </div>
      <svg
        width={width}
        height={height}
        className="border border-gray-100 bg-gray-50 rounded"
      >
        {/* Bars */}
        {history.map((item, i) => {
          const x = padding + i * (barWidth + barGap);
          const isZero = item.qty === 0;
          let y = getY(item.qty);
          let h = height - padding - y;
          let fill = "#3b82f6";

          if (isZero) {
            h = 2; // Small height for zero value
            y = height - padding - h;
            fill = "#ef4444"; // Red color
          }

          return (
            <rect
              key={item.date}
              x={x}
              y={y}
              width={barWidth}
              height={h}
              fill={fill}
              opacity={0.8}
            >
              <title>
                {item.date}: {item.qty}
              </title>
            </rect>
          );
        })}

        {/* Average Line */}
        <line
          x1={padding}
          y1={avgY}
          x2={width - rightAxisWidth - padding}
          y2={avgY}
          stroke="#ef4444"
          strokeWidth="1"
          strokeDasharray="4 2"
        >
          <title>Average: {avgQty.toFixed(1)}</title>
        </line>

        {/* Y-Axis (Right Side) */}
        <line
          x1={width - rightAxisWidth}
          y1={padding}
          x2={width - rightAxisWidth}
          y2={height - padding}
          stroke="#e5e7eb"
          strokeWidth="1"
        />

        {/* Max Label */}
        <text
          x={width - rightAxisWidth + 4}
          y={padding + 8}
          className="text-[9px] fill-gray-500 font-medium"
        >
          {Math.round(maxQty)}
        </text>

        {/* Average Label */}
        <text
          x={width - rightAxisWidth + 4}
          y={avgY + 3}
          className="text-[9px] fill-red-500 font-medium"
        >
          {Math.round(avgQty)}
        </text>

        {/* Zero Label */}
        <text
          x={width - rightAxisWidth + 4}
          y={height - padding}
          className="text-[9px] fill-gray-500 font-medium"
        >
          0
        </text>
      </svg>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
        <span>{dateFormatter.format(minDate)}</span>
        <span>{dateFormatter.format(maxDate)}</span>
      </div>
    </div>
  );
};

const MapController = ({
  selectedRouteId,
  routes,
}: {
  selectedRouteId: number | null;
  routes: Route[];
}) => {
  const map = useMap();
  const [initialView, setInitialView] = useState<{
    center: { lat: number; lng: number };
    zoom: number;
  } | null>(null);

  // Capture the initial view when the map is first loaded
  useEffect(() => {
    if (!initialView) {
      setInitialView({
        center: map.getCenter(),
        zoom: map.getZoom(),
      });
    }
  }, [map]); // Depend only on map to run once on mount

  useEffect(() => {
    if (selectedRouteId === null) {
      // Restore to the initial view when no route is selected
      if (initialView) {
        map.flyTo(initialView.center, initialView.zoom, { duration: 0.3 });
      }
    }
  }, [selectedRouteId, map, initialView]);

  useEffect(() => {
    if (selectedRouteId === null) return;

    const route = routes.find((r) => r.routeId === selectedRouteId);
    if (
      !route ||
      !route.destinationLat ||
      !route.destinationLng ||
      !route.plant
    )
      return;

    const plantLocation = plantCoords[route.plant as keyof typeof plantCoords];
    if (!plantLocation) return;

    const bounds: LatLngBoundsExpression = [
      [plantLocation.latitude, plantLocation.longitude],
      [route.destinationLat, route.destinationLng],
    ];

    map.fitBounds(bounds, { padding: [100, 100], maxZoom: 12 });
  }, [selectedRouteId, routes, map]);

  return null;
};

export const Map = ({
  routes,
  from,
  to,
  product,
}: {
  routes: Route[];
  from?: Date;
  to?: Date;
  product?: string;
}) => {
  const [heatmapMode, setHeatmapMode] = useState(() => {
    // Check to ensure this runs only on the client, and not during SSR,
    // since localStorage is not available on the server.
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(HEATMAP_MODE_KEY);
      return stored ? JSON.parse(stored) : false;
    }
    return false;
  });
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem(HEATMAP_MODE_KEY, JSON.stringify(heatmapMode));
  }, [heatmapMode]);

  const plantColors: Record<number, string> = {
    1100: "red",
    1200: "blue",
    1300: "green",
  };

  const { minQty, maxQty } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    routes.forEach((r) => {
      const qty = r.totalQty || 0;
      if (qty < min) min = qty;
      if (qty > max) max = qty;
    });
    return { minQty: min, maxQty: max };
  }, [routes]);

  const getHeatmapColor = (qty: number) => {
    if (maxQty === minQty) return "rgb(255, 0, 0)";
    const ratio = (qty - minQty) / (maxQty - minQty);
    const g = Math.round(255 * (1 - ratio));
    return `rgb(255, ${g}, 0)`;
  };

  const groupedRoutes = useMemo(() => {
    const groups: Record<string, Route[]> = {};
    routes.forEach((route) => {
      if (!route.destinationLat || !route.destinationLng) return;
      const key = `${route.destinationLat}-${route.destinationLng}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(route);
    });
    return groups;
  }, [routes]);

  const sortedRoutes = useMemo(() => {
    return [...routes].sort((a, b) => (b.totalQty || 0) - (a.totalQty || 0));
  }, [routes]);

  const getDetailsUrl = (routeId: number) => {
    const params = new URLSearchParams();
    if (from) params.set("from", formatDate(from));
    if (to) params.set("to", formatDate(to));
    if (product) params.set("product", product);

    params.set("routes", String(routeId));
    params.set("grouping", "plant,routeDistance,destination,distChannel");

    return `/top-customers-fd?${params.toString()}`;
  };

  const createPieIcon = (routesInGroup: Route[]) => {
    const radius = 6;
    const size = radius * 2;

    if (heatmapMode) {
      const maxQtyRoute = routesInGroup.reduce((prev, current) =>
        (prev.totalQty || 0) > (current.totalQty || 0) ? prev : current,
      );
      const color = getHeatmapColor(maxQtyRoute.totalQty || 0);

      return divIcon({
        className: "",
        html: `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${radius}" cy="${radius}" r="${radius}" fill="${color}" fill-opacity="0.8" />
        </svg>`,
        iconSize: [size, size],
      });
    }

    const plants = routesInGroup
      .map((r) => r.plant)
      .filter(Boolean) as number[];
    const uniquePlants = Array.from(new Set(plants));
    const count = uniquePlants.length;

    if (count <= 1) {
      const color = plantColors[uniquePlants[0]] || "gray";
      return divIcon({
        className: "",
        html: `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${radius}" cy="${radius}" r="${radius}" fill="${color}" fill-opacity="0.8" />
        </svg>`,
        iconSize: [size, size],
      });
    }

    const total = uniquePlants.length;
    const sliceAngle = 360 / total;
    let startAngle = 0;

    const paths = uniquePlants.map((plantId) => {
      const color = plantColors[plantId] || "gray";
      const endAngle = startAngle + sliceAngle;

      const x1 = radius + radius * Math.cos((Math.PI * startAngle) / 180);
      const y1 = radius + radius * Math.sin((Math.PI * startAngle) / 180);
      const x2 = radius + radius * Math.cos((Math.PI * endAngle) / 180);
      const y2 = radius + radius * Math.sin((Math.PI * endAngle) / 180);

      const largeArcFlag = sliceAngle > 180 ? 1 : 0;

      const pathData = `M ${radius} ${radius} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

      startAngle += sliceAngle;
      return `<path d="${pathData}" fill="${color}" fill-opacity="0.8" border="none" stroke="none" />`;
    });

    return divIcon({
      className: "",
      html: `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform: rotate(-90deg)">
        ${paths.join("")}
      </svg>`,
      iconSize: [size, size],
    });
  };

  return (
    <div className="flex h-full w-full">
      <div className="grow h-full relative z-0">
        <div className="absolute top-4 right-4 z-500 bg-white p-2 rounded-lg shadow flex gap-2">
          <Button
            variant={heatmapMode ? "destructive" : "secondary"}
            className="w-40"
            onClick={() => setHeatmapMode(!heatmapMode)}
          >
            {heatmapMode ? "Disable Heatmap" : "Enable Heatmap"}
          </Button>
          <TimeDirectionButton lockedDirection="forward" />
        </div>

        <MapContainer
          center={[20.5937, 78.9629]} // Center of India
          zoom={5}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <MapController selectedRouteId={selectedRouteId} routes={routes} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Plot Plants */}
          {Object.entries(plantCoords).map(([plantId, coords]) => (
            <CircleMarker
              key={`plant-${plantId}`}
              center={[coords.latitude, coords.longitude]}
              pathOptions={{
                color: plantColors[Number(plantId)] || "black",
                fillColor: plantColors[Number(plantId)] || "black",
                fillOpacity: 1,
              }}
              radius={6}
            />
          ))}

          {/* Plot Route Lines */}
          {routes.map((route) => {
            if (!route.destinationLat || !route.destinationLng || !route.plant)
              return null;

            const plantLocation =
              plantCoords[route.plant as keyof typeof plantCoords];
            if (!plantLocation) return null;

            const isSelected = selectedRouteId === route.routeId;
            const baseColor = heatmapMode
              ? getHeatmapColor(route.totalQty || 0)
              : plantColors[route.plant] || "gray";

            const color = isSelected ? "purple" : baseColor;
            const weight = isSelected ? 4 : heatmapMode ? 2 : 1;
            const opacity = isSelected ? 1 : 0.4;

            return (
              <Polyline
                key={`line-${route.routeId}`}
                positions={[
                  [plantLocation.latitude, plantLocation.longitude],
                  [route.destinationLat, route.destinationLng],
                ]}
                pathOptions={{
                  color,
                  weight,
                  opacity,
                }}
              />
            );
          })}

          {/* Plot Destination Dots */}
          {Object.values(groupedRoutes).map((group) => {
            const representative = group[0];
            if (
              !representative.destinationLat ||
              !representative.destinationLng ||
              !representative.plant
            )
              return null;

            const icon = createPieIcon(group);

            return (
              <Marker
                key={`dest-${representative.destinationLat}-${representative.destinationLng}`}
                position={[
                  representative.destinationLat,
                  representative.destinationLng,
                ]}
                icon={icon}
              >
                <Popup>
                  <div className="max-h-64 overflow-y-auto">
                    <div className="mb-2 font-bold sticky top-0 bg-white pb-1 border-b">
                      {representative.city}, {representative.region}
                    </div>
                    <div className="space-y-3">
                      {group.map((route) => (
                        <div key={route.routeId} className="text-sm">
                          <div className="flex items-center justify-between">
                            <div
                              className="font-semibold"
                              style={{
                                color: plantColors[route.plant!] || "black",
                              }}
                            >
                              Plant: {route.plant}
                            </div>
                            <Link
                              href={getDetailsUrl(route.routeId!)}
                              target="_blank"
                              className="inline-flex items-center justify-center p-1 hover:bg-gray-200 rounded-full"
                            >
                              <ExternalLink className="w-4 h-4 text-gray-500" />
                            </Link>
                          </div>
                          <div>
                            Qty:{" "}
                            {route.totalQty?.toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })}{" "}
                            MT
                          </div>
                          <div>
                            Avg Rate:{" "}
                            {route.avgPrice?.toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })}
                          </div>
                          <RouteHistoryChart history={route.history} />
                        </div>
                      ))}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Side Panel Table */}
      <div className="w-100 h-full border-l bg-white overflow-hidden flex flex-col shadow-xl z-10">
        <div className="p-4 border-b font-bold text-lg bg-gray-50">
          Routes by Quantity
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">
                  Destination
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  Plant
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  Km
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  Qty
                </th>
                <th className="px-3 py-2 text-center font-medium text-gray-500">
                  Link
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedRoutes.map((route) => (
                <tr
                  key={route.routeId}
                  className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedRouteId === route.routeId
                      ? "bg-blue-50 hover:bg-blue-100"
                      : ""
                  }`}
                  onClick={() =>
                    setSelectedRouteId(
                      route.routeId === selectedRouteId ? null : route.routeId,
                    )
                  }
                >
                  <td className="px-3 py-2">
                    <div
                      className="font-medium truncate max-w-[120px]"
                      title={`${route.city}, ${route.region}`}
                    >
                      {route.city}
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-[120px]">
                      {route.region}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    <div className="inline-flex items-center justify-between min-w-12">
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-1"
                        style={{
                          backgroundColor: plantColors[route.plant!] || "gray",
                        }}
                      ></span>
                      {route.plant}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    {route.distanceKm ? Math.round(route.distanceKm) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {route.totalQty?.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Link
                      href={getDetailsUrl(route.routeId!)}
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-center p-1 hover:bg-gray-200 rounded-full"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-500" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
