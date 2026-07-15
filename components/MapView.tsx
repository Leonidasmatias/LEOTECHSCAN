"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { SiteRow } from "@/lib/types";

const colors: Record<string, string> = { Baixo: "#3ddc97", Médio: "#f5c451", Alto: "#ff8a4c", Crítico: "#ff4d6d" };

export default function MapView({ points, mode = "points", onSelect }: { points: SiteRow[]; mode?: "points" | "heatmap"; onSelect?: (site: SiteRow) => void }) {
  return (
    <MapContainer center={[-14.3, -51.9]} zoom={4} minZoom={3} scrollWheelZoom preferCanvas className={`map ${mode === "heatmap" ? "heatmap-mode" : ""}`}>
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {points.map(point => (
        <CircleMarker key={point.id} center={[point.latitude, point.longitude]} eventHandlers={{ click: () => onSelect?.(point) }} radius={mode === "heatmap" ? 19 : 5} pathOptions={mode === "heatmap" ? { color: "transparent", fillColor: "#ff4d6d", fillOpacity: .075, weight: 0 } : { color: colors[point.risco] || "#8fa3bf", fillColor: colors[point.risco] || "#8fa3bf", fillOpacity: .72, weight: 1 }}>
          <Popup><strong>{point.siteId}</strong><br />{point.municipio}/{point.estado}<br />{point.tecnologia} · {point.status}<br />GEO SCORE: <b>{point.geoScore}</b> ({point.risco})</Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
