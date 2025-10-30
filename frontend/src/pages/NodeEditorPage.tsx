// frontend/src/pages/NodeEditorPage.tsx
import { useState, useMemo, useEffect } from "react";
// 1. Impor 'CircleMarker' dan hapus 'Marker'
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
  Tooltip,
  useMap,
  CircleMarker,
} from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import { useAllNodes } from "../hooks/useAllNodes";
import { useToast } from "@/hooks/use-toast";
import L from "leaflet";
import "leaflet-draw";
// import type { Geometry } from "geojson";

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy } from "lucide-react";

// Fix icon default Leaflet (opsional tapi disarankan)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function MapFlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 16);
  }, [center, map]);
  return null;
}

export default function NodeEditorPage() {
  const { data: nodes = [], isLoading: isLoadingNodes } = useAllNodes();
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const { toast } = useToast();
  const [jsonOutput, setJsonOutput] = useState("");

  const parks = useMemo(() => nodes.filter(n => n.kind === "park"), [nodes]);
  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId), [nodes, selectedNodeId]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (selectedNode) return [selectedNode.lat, selectedNode.lon];
    return [-7.2575, 112.7521]; // Center Surabaya
  }, [selectedNode]);

  const onCreated = (e: L.DrawEvents.Created) => {
    if (!selectedNodeId) {
      toast({ title: "Pilih Node Dulu", variant: "destructive" });
      e.layer.remove();
      return;
    }
    const geo = (e.layer as L.Polyline).toGeoJSON().geometry;
    const jsonString = JSON.stringify(geo, null, 2);
    setJsonOutput(jsonString);
    toast({ title: "Bentuk digambar!", description: "JSON untuk di-copy telah dibuat di bawah." });
  };

  const onEdit = (e: L.DrawEvents.Edited) => {
    const layers = e.layers.getLayers();
    if (layers.length > 0) {
      const geo = (layers[0] as L.Polyline).toGeoJSON().geometry;
      const jsonString = JSON.stringify(geo, null, 2);
      setJsonOutput(jsonString);
    }
  };

  const onDelete = () => {
    setJsonOutput("");
    // TODO: Hapus juga layer yg ada di FeatureGroup
  };

  const copyToClipboard = () => {
    if (!jsonOutput) {
      toast({ title: "Tidak ada JSON untuk di-copy", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(jsonOutput);
    toast({ title: "Tersalin ke Clipboard!" });
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Editor Geometri Taman</h1>
      <p className="text-muted-foreground">
        Solusi ini tidak menyimpan ke database. Anda harus copy-paste JSON secara manual.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>1. Pilih & Gambar Taman</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedNodeId} onValueChange={setSelectedNodeId} disabled={isLoadingNodes}>
              <SelectTrigger>
                <SelectValue placeholder="— Pilih taman yang akan digambar —" />
              </SelectTrigger>
              {/* 2. Tambahkan z-index tinggi agar dropdown di atas peta */}
              <SelectContent className="z-[1000]">
                {parks.map(n => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name ?? n.id} {n.geometry ? " (✅ Punya geometri)" : " (❌ Belum punya)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <MapContainer
              center={mapCenter}
              zoom={14}
              className="map-box w-full h-[400px] rounded-xl overflow-hidden border"
            >
              {selectedNode && <MapFlyTo center={mapCenter} />}
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              {/* 3. Ganti <Marker> tunggal dengan .map() untuk semua taman */}
              {parks.map((park) => {
                const isSelected = park.id === selectedNodeId;
                return (
                  <CircleMarker
                    key={park.id}
                    center={[park.lat, park.lon]}
                    radius={isSelected ? 8 : 5} // Buat yg terpilih lebih besar
                    pathOptions={{
                      color: isSelected ? "#1d4ed8" : "#16a34a", // Biru jika terpilih
                      fillColor: isSelected ? "#1d4ed8" : "#22c55e", // Hijau default
                      fillOpacity: 0.8,
                    }}
                    // 4. Tambahkan event handler agar bisa diklik
                    eventHandlers={{
                      click: () => {
                        setSelectedNodeId(park.id);
                        onDelete(); // Hapus JSON/gambar lama saat ganti node
                      },
                    }}
                  >
                    <Tooltip>
                      <div><b>{park.name ?? park.id}</b></div>
                      <div>{park.geometry ? "✅ Punya geometri" : "❌ Belum punya"}</div>
                    </Tooltip>
                  </CircleMarker>
                );
              })}

              <FeatureGroup>
                <EditControl
                  position="topright"
                  onCreated={onCreated}
                  onEdited={onEdit}
                  onDeleted={onDelete}
                  draw={{
                    rectangle: false,
                    circle: false,
                    marker: false,
                    circlemarker: false,
                    polyline: true,
                    polygon: true,
                  }}
                />
              </FeatureGroup>
            </MapContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Copy Geometri JSON</CardTitle>
            <CardDescription>
              Buka file <code className="bg-muted px-1 rounded-sm">frontend/src/data/nodes.data.ts</code>,
              cari node <code className="bg-muted px-1 rounded-sm">{selectedNode?.name ?? "..."}</code>,
              dan paste JSON ini ke field <code className="bg-muted px-1 rounded-sm">geometry</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              readOnly
              value={jsonOutput}
              placeholder="Data GeoJSON akan muncul di sini setelah Anda menggambar..."
              className="h-[300px] font-mono text-xs"
            />
            <Button onClick={copyToClipboard} disabled={!jsonOutput}>
              <Copy className="mr-2 h-4 w-4" />
              Copy JSON
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
