"use client";

import { useMemo } from "react";
import { plantCoords } from "@/lib/constants";
import "leaflet/dist/leaflet.css";
import { divIcon } from "leaflet";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Marker,
  Popup,
} from "react-leaflet";
import { getSalesByRoute } from "@/lib/api";

type Route = Awaited<ReturnType<typeof getSalesByRoute>>[number];

export const Map = ({ routes }: { routes: Route[] }) => {
  const plantColors: Record<number, string> = {
    1100: "red",
    1200: "blue",
    1300: "green",
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

  const createPieIcon = (plants: number[]) => {
    const uniquePlants = Array.from(new Set(plants));
    const count = uniquePlants.length;
    const radius = 6;
    const size = radius * 2;

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
    <div className="h-full w-full relative z-0">
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
          >
            <Popup>
              Plant {plantId} <br />
              Lat: {coords.latitude}, Lng: {coords.longitude}
            </Popup>
          </CircleMarker>
        ))}

        {/* Plot Route Lines */}
        {routes.map((route) => {
          if (!route.destinationLat || !route.destinationLng || !route.plant)
            return null;

          const plantLocation =
            plantCoords[route.plant as keyof typeof plantCoords];
          if (!plantLocation) return null;

          return (
            <Polyline
              key={`line-${route.routeId}`}
              positions={[
                [plantLocation.latitude, plantLocation.longitude],
                [route.destinationLat, route.destinationLng],
              ]}
              pathOptions={{
                color: plantColors[route.plant] || "gray",
                weight: 1,
                opacity: 0.4,
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

          const plants = group.map((r) => r.plant).filter(Boolean) as number[];
          const icon = createPieIcon(plants);

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
                        <div
                          className="font-semibold"
                          style={{
                            color: plantColors[route.plant!] || "black",
                          }}
                        >
                          Plant: {route.plant}
                        </div>
                        <div>Qty: {route.totalQty?.toLocaleString()} MT</div>
                        <div>
                          Avg Rate:{" "}
                          {route.avgPrice?.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                        </div>
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
  );
};
