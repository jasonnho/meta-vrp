import {
    MapContainer,
    TileLayer,
    Marker,
    Tooltip,
    useMap,
    GeoJSON,
} from "react-leaflet";
import { useMemo, useEffect } from "react";
import type { Node, OptimizeResponse } from "../types";
import type { Geometry } from "geojson";
import L from "leaflet";
import { getDemandColor } from "../lib/utils";
import MapLegend from "./MapLegend";

type Props = {
    nodes: Node[];
    result: OptimizeResponse;
    vehicleRoutes: Record<number, Geometry[]>;
    highlightedVehicleId: number | null;
    showOnlyHighlighted?: boolean; // <-- PROP BARU
};

function MapAutoResize() {
    const map = useMap();
    useEffect(() => {
        setTimeout(() => map.invalidateSize(), 0);
    }, [map]);
    return null;
}

const routeColors = [
    "#1d4ed8",
    "#c026d3",
    "#db2777",
    "#ea580c",
    "#ca8a04",
    "#059669",
];

const createIcon = (
    type: string,
    demand: number = 0,
    isDimmed: boolean = false
) => {
    let svgContent = "";
    let color = "";
    let borderColor = "";

    const opacity = isDimmed ? 0.3 : 1;

    if (type === "depot") {
        color = "#4b5563";
        borderColor = "#374151";
        svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
    } else if (type === "refill") {
        color = "#2563eb";
        borderColor = "#1d4ed8";
        svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-5-9-7-15-2 6-7 13-7 15a7 7 0 0 0 7 7z"/></svg>`;
    } else {
        color = getDemandColor(demand);
        borderColor = color;
        svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 19h8a4 4 0 0 0 3.8-5.2 6 6 0 0 0-4-11.5 6 6 0 0 0-11.5 3.6C2.8 7.9 3 12.1 8 19Z"/><path d="M12 19v3"/></svg>`;
    }

    return L.divIcon({
        className: "",
        html: `
      <div style="
        display: flex; align-items: center; justify-content: center;
        width: 32px; height: 32px;
        background-color: white; border-radius: 50%;
        border: 2px solid ${borderColor};
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        opacity: ${opacity};
        filter: ${isDimmed ? "grayscale(100%)" : "none"};
      ">
        ${svgContent}
      </div>
    `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
    });
};

export default function OptimizeResultMap({
    nodes,
    result,
    vehicleRoutes,
    highlightedVehicleId,
    showOnlyHighlighted = false, // Default false
}: Props) {
    const nodesById = useMemo(
        () => new Map(nodes.map((n) => [n.id, n])),
        [nodes]
    );

    const vehicleNodes = useMemo(() => {
        const map = new Map<number, Set<string>>();
        result.routes.forEach((r) => {
            const ids = new Set<string>();
            r.sequence.forEach((id) => ids.add(id.split("#")[0]));
            map.set(r.vehicle_id, ids);
        });
        return map;
    }, [result]);

    const allInvolvedNodes = useMemo(() => {
        const nodeIds = new Set<string>();
        result.routes.forEach((r) =>
            r.sequence.forEach((id) => nodeIds.add(id.split("#")[0]))
        );
        return Array.from(nodeIds)
            .map((id) => nodesById.get(id))
            .filter(Boolean) as Node[];
    }, [result, nodesById]);

    const center = useMemo<[number, number]>(() => {
        if (!allInvolvedNodes.length) return [-7.2575, 112.7521];
        const lat =
            allInvolvedNodes.reduce((s, n) => s + n.lat, 0) /
            allInvolvedNodes.length;
        const lon =
            allInvolvedNodes.reduce((s, n) => s + n.lon, 0) /
            allInvolvedNodes.length;
        return [lat, lon];
    }, [allInvolvedNodes]);

    return (
        <div className="relative w-full h-full">
            {/* Sembunyikan Legend jika sedang mode isolasi (export PDF) */}
            {!showOnlyHighlighted && <MapLegend />}

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

                {/* Render Node */}
                {allInvolvedNodes.map((n) => {
                    let isDimmed = false;
                    if (highlightedVehicleId !== null) {
                        const nodesOfVeh =
                            vehicleNodes.get(highlightedVehicleId);
                        // Jika node ini TIDAK dilewati kendaraan yang di-highlight, tandai dimmed
                        if (!nodesOfVeh?.has(n.id)) {
                            isDimmed = true;
                        }
                    }

                    // LOGIKA BARU: Jika mode 'showOnlyHighlighted' aktif dan node ini dimmed, JANGAN RENDER
                    if (showOnlyHighlighted && isDimmed) return null;

                    const color = getDemandColor(n.demand);

                    return (
                        <div key={n.id}>
                            {n.kind === "park" && n.geometry && (
                                <GeoJSON
                                    data={n.geometry}
                                    style={{
                                        color: color,
                                        weight: 3,
                                        opacity: isDimmed ? 0.1 : 0.8,
                                        fillColor: color,
                                        fillOpacity: isDimmed ? 0.05 : 0.4,
                                    }}
                                >
                                    <Tooltip>{n.name ?? n.id}</Tooltip>
                                </GeoJSON>
                            )}

                            <Marker
                                position={[n.lat, n.lon]}
                                icon={createIcon(
                                    n.kind || "park",
                                    n.demand,
                                    isDimmed
                                )}
                            >
                                {/* Hilangkan tooltip saat mode export agar bersih */}
                                {!showOnlyHighlighted && (
                                    <Tooltip direction="top" offset={[0, -32]}>
                                        <div className="text-xs">
                                            <div className="font-bold uppercase">
                                                {n.kind}
                                            </div>
                                            <div>{n.name ?? n.id}</div>
                                            {n.kind === "park" && (
                                                <div>
                                                    Demand:{" "}
                                                    {n.demand?.toLocaleString()}{" "}
                                                    L
                                                </div>
                                            )}
                                        </div>
                                    </Tooltip>
                                )}
                            </Marker>
                        </div>
                    );
                })}

                {/* Render Rute */}
                {Object.entries(vehicleRoutes).map(([vehIdStr, geometries]) => {
                    const vehId = Number(vehIdStr);
                    const isDimmed =
                        highlightedVehicleId !== null &&
                        highlightedVehicleId !== vehId;

                    // LOGIKA BARU: Sembunyikan rute lain saat mode export
                    if (showOnlyHighlighted && isDimmed) return null;

                    const routeIndex = result.routes.findIndex(
                        (r) => r.vehicle_id === vehId
                    );
                    const color = routeColors[routeIndex % routeColors.length];

                    return geometries.map((geo, geoIdx) => (
                        <GeoJSON
                            key={`route-${vehId}-${geoIdx}`}
                            data={geo}
                            style={{
                                color: isDimmed ? "#9ca3af" : color,
                                weight: isDimmed ? 2 : 5,
                                opacity: isDimmed ? 0.2 : 0.9,
                            }}
                        />
                    ));
                })}
            </MapContainer>
        </div>
    );
}
