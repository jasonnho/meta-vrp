// frontend/src/components/NodesMapSelector.tsx
import {
    MapContainer,
    TileLayer,
    Marker,
    Tooltip,
    useMap,
    GeoJSON,
} from "react-leaflet";
import { useMemo, useEffect } from "react";
import type { Node } from "../types";
import type { Geometry } from "geojson";
import L from "leaflet";
import { getDemandColor } from "../lib/utils";

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

// --- Custom Icons (DIPERBAIKI) ---
// Sekarang menerima parameter 'color'
const createTreeIcon = (isSelected: boolean, color: string) =>
    L.divIcon({
        className: "",
        html: `
    <div style="
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px;
      background-color: white; border-radius: 50%;
      /* Gunakan warna dinamis (color) jika tidak dipilih */
      border: 2px solid ${isSelected ? "#2563eb" : color};
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
        fill="${isSelected ? "#2563eb" : color}"
        stroke="${isSelected ? "#2563eb" : color}"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 19h8a4 4 0 0 0 3.8-5.2 6 6 0 0 0-4-11.5 6 6 0 0 0-11.5 3.6C2.8 7.9 3 12.1 8 19Z"/><path d="M12 19v3"/>
      </svg>
    </div>
  `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
    });

export default function NodesMapSelector({ nodes, selected, onToggle }: Props) {
    const parks = useMemo(
        () => nodes.filter((n) => n.kind === "park"),
        [nodes]
    );

    const center = useMemo<[number, number]>(() => {
        if (!parks.length) return [-7.2575, 112.7521];
        const lat = parks.reduce((s, n) => s + n.lat, 0) / parks.length;
        const lon = parks.reduce((s, n) => s + n.lon, 0) / parks.length;
        return [lat, lon];
    }, [parks]);

    return (
        <MapContainer
            center={center}
            zoom={13}
            className="map-box w-full h-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
            preferCanvas={true}
        >
            <MapAutoResize />
            <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {parks.map((n) => {
                const isSel = selected.has(n.id);
                // 1. Hitung warna berdasarkan demand
                const demandColor = getDemandColor(n.demand);

                // 2. Tentukan warna akhir (Biru jika dipilih, warna demand jika tidak)
                const finalColor = isSel ? "#1d4ed8" : demandColor;

                const geoJsonStyle = {
                    color: finalColor,
                    weight: 3,
                    opacity: 0.8,
                    fillColor: finalColor,
                    fillOpacity: 0.4,
                };

                return (
                    <div key={n.id}>
                        {/* Layer Geometri */}
                        {n.geometry && (
                            <GeoJSON
                                data={n.geometry as Geometry}
                                style={geoJsonStyle}
                                eventHandlers={{ click: () => onToggle(n.id) }}
                            />
                        )}

                        {/* Layer Marker */}
                        <Marker
                            position={[n.lat, n.lon]}
                            // 3. KIRIM WARNA DEMAND KE IKON
                            icon={createTreeIcon(isSel, demandColor)}
                            eventHandlers={{ click: () => onToggle(n.id) }}
                        >
                            <Tooltip direction="top" offset={[0, -32]}>
                                <div className="text-xs">
                                    <div className="font-bold">
                                        {n.name ?? n.id}
                                    </div>
                                    <div>
                                        Kebutuhan: {n.demand?.toLocaleString()}{" "}
                                        L
                                    </div>
                                    <div>
                                        {isSel
                                            ? "✅ Terpilih"
                                            : "⬜ Klik untuk pilih"}
                                    </div>
                                </div>
                            </Tooltip>
                        </Marker>
                    </div>
                );
            })}
        </MapContainer>
    );
}
