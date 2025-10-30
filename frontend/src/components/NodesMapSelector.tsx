// frontend/src/components/NodesMapSelector.tsx

// 1. IMPOR DIPERBARUI: Tambahkan GeoJSON
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, GeoJSON } from "react-leaflet";
import { useMemo, useEffect } from "react";
import type { Node } from "../types";
import type { Geometry } from "geojson"; // <-- 2. IMPOR TIPE BARU

type Props = {
  nodes: Node[];
  selected: Set<string>;
  onToggle: (id: string) => void;
};

function MapAutoResize() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 0);
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [map]);
  return null;
}

export default function NodesMapSelector({ nodes, selected, onToggle }: Props) {
  // 🔹 ambil hanya park
  const parks = useMemo(() => nodes.filter(n => n.kind === "park"), [nodes]);
  console.log("DATA DITERIMA PETA:", parks);

  const center = useMemo<[number, number]>(() => {
    if (!parks.length) return [-7.2575, 112.7521];
    const lat = parks.reduce((s, n) => s + n.lat, 0) / parks.length;
    const lon = parks.reduce((s, n) => s + n.lon, 0) / parks.length;
    return [lat, lon];
  }, [parks]);

  return (
    <MapContainer
      center={center}
      zoom={12}
      className="map-box w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
    >
      <MapAutoResize />
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {parks.map((n) => {
        const isSel = selected.has(n.id);

        // 3. Style untuk GeoJSON (jika ada geometri)
        const geoJsonStyle = {
          color: isSel ? "#1d4ed8" : "#16a34a",   // biru saat dipilih, hijau default
          weight: 5, // Buat lebih tebal agar terlihat
          opacity: 0.7,
          fillColor: isSel ? "#1d4ed8" : "#22c55e",
          fillOpacity: 0.4, // Buat isian agak transparan
        };

        // 4. Style untuk CircleMarker (fallback)
        const circleMarkerStyle = {
          color: isSel ? "#1d4ed8" : "#16a34a",
          fillColor: isSel ? "#1d4ed8" : "#22c55e",
        };

        // ==========================================================
        //  👇 5. LOGIKA UTAMA ADA DI SINI 👇
        // ==========================================================

        // JIKA node punya data geometri, gambar sebagai GeoJSON (area/garis)
        if (n.geometry) {
          return (
            <GeoJSON
              key={n.id}
              data={n.geometry as Geometry} // Cast ke tipe Geometry
              style={geoJsonStyle}
              eventHandlers={{ click: () => onToggle(n.id) }}
            >
              <Tooltip>
                <div className="text-xs">
                  <div><b>{n.name ?? n.id}</b></div>
                  <div>Type: park</div>
                  <div>Selected: {isSel ? "Yes" : "No"}</div>
                </div>
              </Tooltip>
            </GeoJSON>
          );
        }

        // JIKA TIDAK, gambar sebagai CircleMarker (titik) seperti sebelumnya
        return (
          <CircleMarker
            key={n.id}
            center={[n.lat, n.lon] as [number, number]}
            pathOptions={circleMarkerStyle} // Gunakan style yg didefinisikan
            radius={6}
            fillOpacity={0.8}
            eventHandlers={{ click: () => onToggle(n.id) }} // klik toggle
          >
            <Tooltip>
              <div className="text-xs">
                <div><b>{n.name ?? n.id}</b></div>
                <div>Type: park</div>
                <div>Selected: {isSel ? "Yes" : "No"}</div>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
