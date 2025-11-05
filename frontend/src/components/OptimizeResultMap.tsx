// frontend/src/components/OptimizeResultMap.tsx
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, GeoJSON } from "react-leaflet";
import { useMemo, useEffect } from "react";
import type { Node, OptimizeResponse } from "../types";
import type { Geometry } from "geojson";

type Props = {
  nodes: Node[];
  result: OptimizeResponse;
  routeGeometries: Geometry[]; // Ini adalah hasil dari OSRM
};

// Helper untuk Auto-Resize Peta
function MapAutoResize() {
  const map = useMap();
  useEffect(() => {
    // Tunda resize sedikit agar container stabil
    setTimeout(() => map.invalidateSize(), 0);
  }, [map]);
  return null;
}

// Skema warna untuk rute kendaraan yang berbeda
const routeColors = [
  "#1d4ed8", // Biru
  "#c026d3", // Fuchsia
  "#db2777", // Pink
  "#ea580c", // Oranye
  "#ca8a04", // Kuning
  "#059669", // Emerald
];

export default function OptimizeResultMap({ nodes, result, routeGeometries }: Props) {
  // Buat Peta (Map) dari ID Node ke objek Node agar mudah dicari
  const nodesById = useMemo(() => {
    return new Map(nodes.map(n => [n.id, n]));
  }, [nodes]);

  // Ambil semua node yang terlibat dalam hasil optimasi
  const involvedNodes = useMemo(() => {
    const nodeIds = new Set<string>();
    result.routes.forEach(r => r.sequence.forEach(id => nodeIds.add(id)));
    // Ubah Set menjadi array objek Node
    return Array.from(nodeIds).map(id => nodesById.get(id)).filter(Boolean) as Node[];
  }, [result, nodesById]);

  // Tentukan titik tengah peta
  const center = useMemo<[number, number]>(() => {
    if (!involvedNodes.length) return [-7.2575, 112.7521]; // Fallback Surabaya
    const lat = involvedNodes.reduce((s, n) => s + n.lat, 0) / involvedNodes.length;
    const lon = involvedNodes.reduce((s, n) => s + n.lon, 0) / involvedNodes.length;
    return [lat, lon];
  }, [involvedNodes]);

  return (
    <MapContainer
      center={center}
      zoom={13}
      className="map-box w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
      // ==========================================================
      // 👇 TAMBAHKAN PROPERTI INI 👇
      // ==========================================================
      preferCanvas={true} // Ini memaksa Leaflet menggunakan Canvas, bukan SVG
    >
      <MapAutoResize />
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* 1. Gambar semua TITIK/AREA taman yang terlibat */}
      {involvedNodes.map((n) => {
        // Jika taman punya geometri (yang Anda gambar di editor), tampilkan itu
        if (n.geometry) {
          return (
            <GeoJSON
              key={`node-geo-${n.id}`}
              data={n.geometry}
              style={{ color: "#16a34a", weight: 4, opacity: 0.7 }} // Warna hijau
            >
              <Tooltip>{n.name ?? n.id}</Tooltip>
            </GeoJSON>
          );
        }
        // Jika tidak, tampilkan sebagai titik
        return (
          <CircleMarker
            key={`node-circle-${n.id}`}
            center={[n.lat, n.lon]}
            radius={6}
            pathOptions={{ color: "#16a34a", fillColor: "#22c55e", fillOpacity: 0.8 }}
          >
            <Tooltip>{n.name ?? n.id}</Tooltip>
          </CircleMarker>
        );
      })}

      {/* 2. Gambar RUTE JALAN RAYA (dari OSRM) */}
      {routeGeometries.map((geo, index) => {
        // Ambil warna berdasarkan index agar konsisten
        const color = routeColors[index % routeColors.length];

        return (
          <GeoJSON
            key={`route-geo-${index}`}
            data={geo}
            style={{
              color: color,
              weight: 5,
              opacity: 0.8,
            }}
          />
        );
      })}
    </MapContainer>
  );
}
