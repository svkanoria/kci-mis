"use client";

import { plantCoords } from "@/lib/constants";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
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
                opacity: 0.2,
              }}
            />
          );
        })}

        {/* Plot Destination Dots */}
        {routes.map((route) => {
          if (!route.destinationLat || !route.destinationLng || !route.plant)
            return null;

          return (
            <CircleMarker
              key={`dest-${route.routeId}`}
              center={[route.destinationLat, route.destinationLng]}
              pathOptions={{
                color: plantColors[route.plant] || "gray",
                fillColor: plantColors[route.plant] || "gray",
                fillOpacity: 0.8,
                weight: 0,
              }}
              radius={4}
            >
              <Popup>
                <strong>
                  {route.city}, {route.region}
                </strong>
                <br />
                Plant: {route.plant}
                <br />
                Qty: {route.totalQty?.toLocaleString()} MT
                <br />
                Avg Rate:
                {route.avgPrice?.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
};
