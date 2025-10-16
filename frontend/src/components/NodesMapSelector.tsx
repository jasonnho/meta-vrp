import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import { useMemo } from "react";
import type { Node } from "../types";

type Props = {
  nodes: Node[];
  selected: Set<string>;
  onToggle: (id: string) => void;
};

export default function NodesMapSelector({ nodes, selected, onToggle }: Props) {
  // ⬅️ pastikan tipe tuple [number, number]
  const center = useMemo<[number, number]>(() => {
    if (!nodes.length) return [-7.2575, 112.7521] as [number, number];
    const lat = nodes.reduce((s, n) => s + n.lat, 0) / nodes.length;
    const lon = nodes.reduce((s, n) => s + n.lon, 0) / nodes.length;
    return [lat, lon];
  }, [nodes]);

  return (
    <MapContainer
      center={center}   // ⬅️ sekarang sudah LatLngTuple
      zoom={12}
      className="map-box rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {nodes.map((n) => {
        const isSel = selected.has(n.id);
        const base =
          n.kind === "depot" ?  { fillOpacity: 0.9, radius: 8 } :
          n.kind === "refill" ? { fillOpacity: 0.7, radius: 7 } :
                                { fillOpacity: 0.6, radius: 6 };
        return (
          <CircleMarker
            key={n.id}
            center={[n.lat, n.lon] as [number, number]}  // ⬅️ cast ke tuple
            pathOptions={{
              color: isSel ? "#1d4ed8" : "#6b7280",
              fillColor: isSel ? "#1d4ed8" : "#9ca3af",
            }}
            {...base}
            eventHandlers={{ click: () => onToggle(n.id) }}
          >
            <Tooltip>
              <div className="text-xs">
                <div><b>{n.name ?? n.id}</b></div>
                <div>Type: {n.kind ?? "-"}</div>
                <div>Selected: {isSel ? "Yes" : "No"}</div>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
