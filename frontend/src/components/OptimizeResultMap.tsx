// frontend/src/components/OptimizeResultMap.tsx
import {
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
  GeoJSON,
  Marker,
} from "react-leaflet";
import { useMemo, useEffect } from "react";
import L from "leaflet";
import type { Node, OptimizeResponse } from "../types";
import type { Geometry } from "geojson";

// --- 1. DEFINISI IKON SVG KUSTOM (DivIcon) ---

// Ikon POHON (untuk Taman)
const createParkIcon = () =>
  L.divIcon({
    className: "custom-icon-park",
    html: `
    <div style="
        background-color: #16a34a;
        width: 30px; height: 30px;
        border-radius: 50%;
        border: 2px solid white;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    ">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10a6 6 0 0 0-6-6c-2 0-3 1-3 3 0 .7.3 1.3.8 1.8A7 7 0 0 1 3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a7 7 0 0 1-.8-8.2c.5-.5.8-1.1.8-1.8 0-2-1-3-3-3a6 6 0 0 0-6 6z"/><path d="M12 19v3"/></svg>
    </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 30], // Anchor di tengah bawah
    popupAnchor: [0, -30],
  });

// Ikon TETESAN AIR (untuk Depot Air/Refill)
const createRefillIcon = () =>
  L.divIcon({
    className: "custom-icon-refill",
    html: `
    <div style="
        background-color: #3b82f6;
        width: 30px; height: 30px;
        border-radius: 50%;
        border: 2px solid white;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    ">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-7.4-1.7-3-4-5.6-4-5.6S8 6 6.3 9c-2 3.5-3 5.4-3 7.4a7 7 0 0 0 7 7z"/></svg>
    </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });

// Ikon RUMAH/GUDANG (untuk Depot Pusat)
const createDepotIcon = () =>
  L.divIcon({
    className: "custom-icon-depot",
    html: `
    <div style="
        background-color: #4b5563;
        width: 34px; height: 34px;
        border-radius: 4px;
        border: 2px solid white;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    ">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });

// --- 2. HELPER COLORS ---

// Warna Rute (Harus sama dengan di OptimizePage.tsx)
const ROUTE_COLORS = [
  "#1d4ed8", // Biru
  "#c026d3", // Fuchsia
  "#db2777", // Pink
  "#ea580c", // Oranye
  "#ca8a04", // Kuning
  "#059669", // Emerald
  "#7c3aed", // Violet
  "#dc2626", // Red
];

// Menghitung warna hijau berdasarkan kebutuhan liter
// Semakin banyak kebutuhan air -> Semakin tua hijaunya
function getParkColor(liters: number = 0) {
  const maxL = 2000; // Asumsi batas atas kebutuhan air (bisa disesuaikan)
  const minL = 0;

  // Normalisasi value ke range 0..1
  const ratio = Math.min(Math.max((liters - minL) / (maxL - minL), 0), 1);

  // Kita mainkan Lightness di HSL:
  // Hijau Muda (Sedikit air): hsl(142, 70%, 75%)
  // Hijau Tua (Banyak air): hsl(142, 70%, 20%)
  const lightness = 75 - ratio * 55;

  return `hsl(142, 70%, ${lightness}%)`;
}

// --- 3. KOMPONEN PENDUKUNG ---

// Komponen Legenda Peta
function LegendControl() {
  return (
    <div className="leaflet-bottom leaflet-right">
      <div className="leaflet-control leaflet-bar bg-white/90 backdrop-blur p-3 shadow-lg rounded-lg text-xs space-y-2 border border-slate-200 text-slate-800">
        <h4 className="font-bold mb-1 border-b pb-1 text-sm">Legenda Peta</h4>

        {/* Simbol Node */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-600 rounded flex items-center justify-center border border-white shadow-sm">
              <svg
                className="w-3 h-3 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
            </div>
            <span>Markas (Depot Pusat)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border border-white shadow-sm">
              <svg
                className="w-3 h-3 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="none"
              >
                <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-7.4-1.7-3-4-5.6-4-5.6S8 6 6.3 9c-2 3.5-3 5.4-3 7.4a7 7 0 0 0 7 7z" />
              </svg>
            </div>
            <span>Sumber Air (Refill)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border border-white shadow-sm">
              <svg
                className="w-3 h-3 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 10a6 6 0 0 0-6-6c-2 0-3 1-3 3 0 .7.3 1.3.8 1.8A7 7 0 0 1 3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a7 7 0 0 1-.8-8.2c.5-.5.8-1.1.8-1.8 0-2-1-3-3-3a6 6 0 0 0-6 6z" />
              </svg>
            </div>
            <span>Taman (Park)</span>
          </div>
        </div>

        <div className="my-1 border-t border-slate-200"></div>

        {/* Gradasi Kebutuhan Air */}
        <div>
          <span className="font-semibold block mb-1">Kebutuhan Air:</span>
          <div className="flex items-center gap-2">
            <span
              className="w-4 h-4 rounded-full border border-slate-300 shadow-sm"
              style={{ background: "hsl(142, 70%, 75%)" }}
            ></span>
            <span>Sedikit (Hijau Muda)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-4 h-4 rounded-full border border-slate-300 shadow-sm"
              style={{ background: "hsl(142, 70%, 20%)" }}
            ></span>
            <span>Banyak (Hijau Tua)</span>
          </div>
        </div>

        <div className="my-1 border-t border-slate-200"></div>

        {/* Warna Rute */}
        <div>
          <h5 className="font-semibold mb-1">Rute Kendaraan</h5>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {ROUTE_COLORS.map((c, i) => (
              <div key={c} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full shadow-sm"
                  style={{ backgroundColor: c }}
                ></span>
                <span>Mobil {i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Auto Fit Bounds Component
function MapAutoFit({ nodes }: { nodes: Node[] }) {
  const map = useMap();
  useEffect(() => {
    if (nodes.length === 0) return;

    // Buat bounds dari semua titik
    const bounds = L.latLngBounds(nodes.map((n) => [n.lat, n.lon]));

    // Fit bounds dengan padding agar tidak mepet pinggir
    map.fitBounds(bounds, { padding: [50, 50] });

    // Fix glitch render tiles (kadang abu-abu jika container resize)
    setTimeout(() => map.invalidateSize(), 200);
  }, [nodes, map]);
  return null;
}

// --- 4. KOMPONEN UTAMA ---

type Props = {
  nodes: Node[];
  result: OptimizeResponse;
  // Data geometri rute sekarang dikelompokkan per Vehicle ID
  routeGeometries: Record<number, Geometry[]>;
  // ID kendaraan yang sedang di-highlight (atau null jika semua aktif)
  highlightedVehicleId: number | null;
};

export default function OptimizeResultMap({
  nodes,
  result,
  routeGeometries,
  highlightedVehicleId,
}: Props) {
  // Mapping ID -> Node Object untuk akses cepat
  const nodesById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes]
  );

  // Filter node yang benar-benar dikunjungi dalam hasil optimasi
  const involvedNodes = useMemo(() => {
    const nodeIds = new Set<string>();
    result.routes.forEach((r) => r.sequence.forEach((id) => nodeIds.add(id)));
    return Array.from(nodeIds)
      .map((id) => nodesById.get(id))
      .filter(Boolean) as Node[];
  }, [result, nodesById]);

  // Tentukan titik tengah awal (fallback jika auto-fit belum jalan)
  const center: [number, number] =
    involvedNodes.length > 0
      ? [involvedNodes[0].lat, involvedNodes[0].lon]
      : [-7.2575, 112.7521]; // Default Surabaya

  return (
    <MapContainer
      center={center}
      zoom={13}
      className="w-full h-full rounded-xl z-0"
      preferCanvas={true} // Performance boost untuk banyak marker
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Auto zoom/pan ke area node */}
      <MapAutoFit nodes={involvedNodes} />

      {/* Tampilkan Legenda */}
      <LegendControl />

      {/* --- A. VISUALISASI RUTE (GARIS JALAN) --- */}
      {Object.entries(routeGeometries).map(([vidStr, geos]) => {
        const vid = Number(vidStr);

        // Cari index rute di result untuk menentukan warna yang konsisten
        const routeIndex = result.routes.findIndex((r) => r.vehicle_id === vid);
        const color = ROUTE_COLORS[routeIndex % ROUTE_COLORS.length] || "#333";

        // Logika Highlight:
        // Jika ada highlightedVehicleId DAN ini bukan kendaraan itu, maka redupkan
        const isDimmed =
          highlightedVehicleId !== null && highlightedVehicleId !== vid;

        // Render setiap segmen geometri
        return geos.map((geo, idx) => (
          <GeoJSON
            key={`route-${vid}-${idx}`}
            data={geo}
            style={{
              color: color,
              weight: isDimmed ? 2 : 5, // Tebal jika aktif, tipis jika redup
              opacity: isDimmed ? 0.1 : 0.8, // Transparan jika redup
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        ));
      })}

      {/* --- B. VISUALISASI NODE (MARKER & AREA) --- */}
      {involvedNodes.map((n) => {
        // 1. Tentukan Ikon berdasarkan jenis node (kind)
        let icon = createParkIcon();
        if (n.kind === "refill") icon = createRefillIcon();
        if (n.kind === "depot") icon = createDepotIcon();

        // 2. Tentukan Warna Polygon (Khusus Taman dengan Geometri Area)
        const polyColor =
          n.kind === "park" ? getParkColor(n.demand_liters) : "#666";

        // Cek apakah node ini perlu diredupkan?
        // (Opsional: Saat ini node tetap jelas agar konteks peta terjaga,
        // tapi jika ingin meredupkan node yang tidak dikunjungi rute terpilih, logika bisa ditambahkan di sini)
        const nodeOpacity = 1;

        return (
          <div key={n.id}>
            {/* Jika Taman punya data Geometri (Area Polygon) */}
            {n.geometry && n.kind === "park" && (
              <GeoJSON
                data={n.geometry}
                style={{
                  color: polyColor,
                  fillColor: polyColor,
                  weight: 2,
                  opacity: nodeOpacity,
                  fillOpacity: 0.6 * nodeOpacity,
                }}
              >
                <Tooltip sticky>
                  <div className="text-sm">
                    <b className="block mb-1">{n.name}</b>
                    <span className="text-xs text-muted-foreground">
                      Kebutuhan: {n.demand_liters} Liter
                    </span>
                  </div>
                </Tooltip>
              </GeoJSON>
            )}

            {/* Marker Point (Selalu ditampilkan sebagai icon) */}
            <Marker position={[n.lat, n.lon]} icon={icon} opacity={nodeOpacity}>
              <Tooltip direction="top" offset={[0, -20]} className="z-50">
                <div className="text-center">
                  <b className="text-sm">{n.name ?? n.id}</b>
                  <div className="text-xs text-muted-foreground capitalize mt-1">
                    {n.kind === "park"
                      ? "Taman"
                      : n.kind === "refill"
                      ? "Depot Air"
                      : "Markas"}
                  </div>
                  {n.demand_liters !== undefined && n.demand_liters > 0 && (
                    <div className="text-xs font-mono mt-1 bg-slate-100 px-1 rounded">
                      {n.demand_liters} L
                    </div>
                  )}
                </div>
              </Tooltip>
            </Marker>
          </div>
        );
      })}
    </MapContainer>
  );
}
