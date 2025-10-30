/* ──────────────────────────────────────────────────────────────
   1. CSS imports
   ────────────────────────────────────────────────────────────── */
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

/* ──────────────────────────────────────────────────────────────
   2. JS/TS imports
   ────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  GeoJSON,
  useMapEvents,
  FeatureGroup,
} from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";
import type { Node } from "@/types";

/* ──────────────────────────────────────────────────────────────
   3. Fix default marker icons
   ────────────────────────────────────────────────────────────── */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ──────────────────────────────────────────────────────────────
   4. Props interface
   ────────────────────────────────────────────────────────────── */
interface Props {
  nodes: Node[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

/* ──────────────────────────────────────────────────────────────
   5. Draw Controller
   ────────────────────────────────────────────────────────────── */
function DrawController({
  drawn,
  setDrawn,
  setChosenPark,
  nodes,
}: {
  drawn: any;
  setDrawn: (v: any) => void;
  setChosenPark: (v: Node | null) => void;
  nodes: Node[];
}) {
  useMapEvents({
    click(e) {
      if (!drawn) return;
      const latlng = e.latlng;
      let closest: Node | null = null;
      let min = 150;

      nodes.forEach((n) => {
        if (n.geometry.type !== "Point") return;
        const coords = n.geometry.coordinates as number[];
        const d = L.latLng(coords[1], coords[0]).distanceTo(latlng);
        if (d < min) {
          min = d;
          closest = n;
        }
      });

      if (closest) setChosenPark(closest);
    },
  });

  return null;
}

/* ──────────────────────────────────────────────────────────────
   6. Main Component
   ────────────────────────────────────────────────────────────── */
export default function MapWithDraw({ nodes, selected, onToggle }: Props) {
  const [drawn, setDrawn] = useState<any>(null);
  const [chosenPark, setChosenPark] = useState<Node | null>(null);
  const [overrides, setOverrides] = useState<Record<string, any>>({});

  useEffect(() => {
    fetch("/nodes")
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, any> = {};
        data.forEach((n: any) => {
          if (n.geometry.type !== "Point") map[n.id] = n.geometry;
        });
        setOverrides(map);
      });
  }, []);

  const save = (id: string, geom: any) => {
    fetch(`/parks/${id}/geometry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geom),
    }).then(() => {
      setOverrides((o) => ({ ...o, [id]: geom }));
      setDrawn(null);
      setChosenPark(null);
    });
  };

  return (
    <MapContainer
      center={[-7.25, 112.75]}
      zoom={12}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {/* DRAW TOOL — MUST BE INSIDE FeatureGroup */}
      <FeatureGroup>
        <EditControl
          position="topright"
          onCreated={(e) => {
            const layer = e.layer;
            const coords = layer.getLatLngs()[0].map((p: any) => [p.lng, p.lat]);
            setDrawn({ type: "LineString", coordinates: coords });
            setChosenPark(null);
          }}
          onDeleted={() => {
            setDrawn(null);
            setChosenPark(null);
          }}
          draw={{
            rectangle: false,
            circle: false,
            marker: false,
            polyline: false,
            circlemarker: false,
            polygon: true,
          }}
          edit={{ edit: false }}
        />
      </FeatureGroup>

      {/* CLICK HANDLER */}
      <DrawController
        drawn={drawn}
        setDrawn={setDrawn}
        setChosenPark={setChosenPark}
        nodes={nodes}
      />

      {/* PREVIEW + SAVE UI */}
      {drawn && (
        <div
          style={{
            position: "absolute",
            top: 80,
            left: 10,
            background: "white",
            padding: 12,
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 1000,
            fontSize: 14,
          }}
        >
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
            Draw line for long park
          </p>
          {chosenPark ? (
            <>
              <p>
                Selected: <strong>{chosenPark.name}</strong>
              </p>
              <button
                onClick={() => save(chosenPark.id, drawn)}
                style={{
                  background: "#10b981",
                  color: "white",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: 4,
                }}
              >
                Save as Line
              </button>
              <button
                onClick={() => {
                  setDrawn(null);
                  setChosenPark(null);
                }}
                style={{
                  marginLeft: 6,
                  background: "#ef4444",
                  color: "white",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: 4,
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <p style={{ color: "#666", fontSize: 13 }}>
              Click a green dot to assign
            </p>
          )}
        </div>
      )}
      {drawn && (
        <GeoJSON
          data={drawn}
          style={{ color: "#10b981", weight: 6, opacity: 0.9 }}
        />
      )}

      {/* MARKERS + LINES */}
      {nodes.map((n) => {
        const geom = overrides[n.id] ?? n.geometry;

        if (geom.type === "Point") {
          const isSel = selected.has(n.id);
          const [lon, lat] = geom.coordinates as number[];
          return (
            <Marker
              key={n.id}
              position={[lat, lon]}
              eventHandlers={{ click: () => onToggle(n.id) }}
              icon={L.divIcon({
                className: "custom-marker",
                html: `<div style="background:${
                  isSel ? "#10b981" : "#6b7280"
                };width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.3);"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })}
            >
              <Popup>{n.name}</Popup>
            </Marker>
          );
        }

        return (
          <GeoJSON
            key={n.id}
            data={geom}
            style={{ color: "#10b981", weight: 6 }}
          />
        );
      })}
    </MapContainer>
  );
}
