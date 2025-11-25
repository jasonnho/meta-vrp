// src/pages/OptimizePage.tsx
import { useMemo, useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Api } from "../lib/api";
import type { OptimizeResponse, Node, Group } from "../types";
import { minutesToHHMM } from "../lib/format";
import NodesMapSelector from "../components/NodesMapSelector";
import { useUI } from "../stores/ui";
import { useOptimizeMem } from "../stores/optimize";
import { motion, AnimatePresence } from "framer-motion";
import type { Geometry } from "geojson";

// Peta hasil
import OptimizeResultMap from "../components/OptimizeResultMap";

// --- SHADCN UI ---
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

// --- ICONS ---
import {
  Loader2,
  Play,
  Trash2,
  ListChecks,
  Users,
  MapPin,
  Settings,
  Search,
  CheckCircle2,
  AlertCircle,
  ListTree,
  Truck,
  FileDown,
  Eye,
  EyeOff,
} from "lucide-react";

// Helper kecil
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Warna rute (Sama dengan urutan warna di Map agar konsisten)
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

export default function OptimizePage() {
  // data nodes & groups
  const nodesQ = useQuery({ queryKey: ["nodes"], queryFn: Api.listNodes });
  const groupsQ = useQuery<Group[]>({
    queryKey: ["groups"],
    queryFn: Api.listGroups,
  });

  // selection titik
  const { maxVehicles, setMaxVehicles, selected, setSelected } = useUI();

  // State untuk OSRM Geometry (Sekarang dikelompokkan per Vehicle ID)
  const [routeGeometries, setRouteGeometries] = useState<
    Record<number, Geometry[]>
  >({});
  const [isFetchingRoutes, setIsFetchingRoutes] = useState(false);

  // State untuk Highlight Rute (Isolasi visual)
  const [highlightedVehicle, setHighlightedVehicle] = useState<number | null>(
    null
  );

  // State untuk PDF
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");

  // Refs untuk elemen PDF
  const mapRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // displayNodes
  const displayNodes = useMemo(() => {
    if (!nodesQ.data) return [];
    return (nodesQ.data as Node[]).filter(
      (node) => node.id !== "0" && node.kind === "park"
    );
  }, [nodesQ.data]);

  // Peta ID -> Node
  const nodesById = useMemo(() => {
    if (!nodesQ.data) return new Map<string, Node>();
    return new Map((nodesQ.data as Node[]).map((n) => [n.id, n]));
  }, [nodesQ.data]);

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const selectAll = () => {
    setSelected(new Set(displayNodes.map((n) => n.id)));
  };

  const { toast } = useToast();
  const { lastResult, setLastResult, clearLastResult } = useOptimizeMem();

  const [groupQuery, setGroupQuery] = useState("");
  const [progress, setProgress] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  // useMutation untuk optimize
  const {
    mutate,
    isPending,
    error: optimizeError,
    data: optimizeData,
    reset: resetOptimize,
  } = useMutation({
    mutationFn: (payload: any) => Api.optimize(payload),
    onSuccess: (res, variables) => {
      setLastResult(res, {
        num_vehicles: variables?.num_vehicles,
        selected_node_ids: variables?.selected_node_ids ?? [],
      });
      toast({
        title: "Optimisasi Selesai",
        description: `Objective ${
          res.objective_time_min
        } menit (${minutesToHHMM(res.objective_time_min)})`,
        action: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      });
    },
    onError: (err: any) => {
      console.error("Optimize error:", err);
      toast({
        title: "Optimasi Gagal",
        description:
          err?.response?.data?.detail ??
          err?.message ??
          "Terjadi kesalahan saat menjalankan optimasi.",
        variant: "destructive",
      });
    },
  });

  const data: OptimizeResponse | undefined = optimizeData ?? lastResult;

  const clearAll = () => {
    setSelected(new Set());
    clearLastResult();
    setRouteGeometries({});
    setHighlightedVehicle(null);
    resetOptimize();
  };

  const handleRun = () => {
    const node_ids = Array.from(selected);
    setRouteGeometries({});
    setHighlightedVehicle(null);
    resetOptimize();
    mutate({
      num_vehicles: maxVehicles,
      selected_node_ids: node_ids,
    });
  };

  // --- FIX: FETCH ROUTE GEOMETRY ---
  // Menggunakan Promise.all agar rute diambil dengan urutan yang benar dan tidak balapan
  useEffect(() => {
    if (data && nodesById.size > 0) {
      const fetchAllRoutes = async () => {
        setIsFetchingRoutes(true);
        const newGeometries: Record<number, Geometry[]> = {};

        for (const route of data.routes) {
          const segments: Promise<Geometry | null>[] = [];
          // Ambil setiap segmen dari urutan sequence
          for (let i = 0; i < route.sequence.length - 1; i++) {
            const nodeA = nodesById.get(route.sequence[i]);
            const nodeB = nodesById.get(route.sequence[i + 1]);

            if (nodeA && nodeB) {
              segments.push(
                Api.getRouteGeometry(
                  nodeA.lon,
                  nodeA.lat,
                  nodeB.lon,
                  nodeB.lat
                ).catch((err) => {
                  console.warn(
                    `Gagal fetch rute ${nodeA.id}->${nodeB.id}`,
                    err
                  );
                  return null;
                })
              );
            } else {
              segments.push(Promise.resolve(null));
            }
          }

          // Tunggu semua segmen kendaraan ini selesai
          const results = await Promise.all(segments);
          newGeometries[route.vehicle_id] = results.filter(
            Boolean
          ) as Geometry[];

          // Delay kecil agar tidak membebani server
          await sleep(100);
        }

        setRouteGeometries(newGeometries);
        setIsFetchingRoutes(false);
      };

      fetchAllRoutes();
    }
  }, [data, nodesById]);

  const handleClearResult = () => {
    clearLastResult();
    setRouteGeometries({});
    setHighlightedVehicle(null);
    resetOptimize();
  };

  // --- NEW: EXPORT PDF WITH ROUTE SNAPSHOTS ---
  const handleExportPDF = async () => {
    if (!mapRef.current || !data) {
      toast({ title: "Data belum siap", variant: "destructive" });
      return;
    }

    setIsExporting(true);
    setExportStatus("Menyiapkan library...");

    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      let currentY = margin;

      // --- HALAMAN 1: SUMMARY & GLOBAL MAP ---
      pdf.setFontSize(16);
      pdf.text("Laporan Optimasi Meta-VRP", margin, currentY);
      currentY += 10;
      pdf.setFontSize(10);
      pdf.text(`Tanggal: ${new Date().toLocaleString()}`, margin, currentY);
      currentY += 10;

      // Ambil Ringkasan
      if (summaryRef.current) {
        setExportStatus("Mengambil ringkasan...");
        const summaryC = await html2canvas(summaryRef.current);
        const summaryImg = summaryC.toDataURL("image/png");
        const h = (summaryC.height * contentWidth) / summaryC.width;
        pdf.addImage(summaryImg, "PNG", margin, currentY, contentWidth, h);
        currentY += h + margin;
      }

      // Ambil Tabel
      if (tableRef.current) {
        setExportStatus("Mengambil tabel...");
        const tableC = await html2canvas(tableRef.current);
        const tableImg = tableC.toDataURL("image/png");
        const h = (tableC.height * contentWidth) / tableC.width;
        if (currentY + h > pageHeight - margin) {
          pdf.addPage();
          currentY = margin;
        }
        pdf.addImage(tableImg, "PNG", margin, currentY, contentWidth, h);
        currentY += h + margin;
      }

      // --- HALAMAN DETAIL: LOOP PER RUTE ---
      setExportStatus("Menyiapkan snapshot rute...");
      const prevHighlight = highlightedVehicle; // Simpan state sebelumnya

      for (let i = 0; i < data.routes.length; i++) {
        const route = data.routes[i];
        const vid = route.vehicle_id;

        // 1. Highlight rute spesifik di React State
        setHighlightedVehicle(vid);

        // 2. Tunggu peta merespons perubahan state (render ulang tile/path)
        setExportStatus(`Snapshot Rute Kendaraan #${vid}...`);
        await sleep(1500); // Delay penting agar visual update

        // 3. Capture Map
        const mapC = await html2canvas(mapRef.current, {
          useCORS: true,
          allowTaint: true,
          // Hilangkan tombol zoom/layer saat di-capture
          ignoreElements: (el) =>
            el.classList.contains("leaflet-control-container"),
        });

        // 4. Tambah Halaman Baru di PDF
        pdf.addPage();
        currentY = margin;

        pdf.setFontSize(14);
        pdf.text(`Detail Rute: Kendaraan #${vid}`, margin, currentY);
        currentY += 8;

        // Info Teknis Rute
        pdf.setFontSize(10);
        pdf.text(`Total Waktu: ${route.total_time_min} min`, margin, currentY);
        currentY += 5;
        pdf.text(`Total Stop: ${route.sequence.length}`, margin, currentY);
        currentY += 8;

        // Masukkan Gambar Map
        const mapImg = mapC.toDataURL("image/png");
        const mapH = (mapC.height * contentWidth) / mapC.width;

        if (currentY + mapH > pageHeight - margin) {
          pdf.addPage();
          currentY = margin;
        }
        pdf.addImage(mapImg, "PNG", margin, currentY, contentWidth, mapH);
        currentY += mapH + margin;

        // Tulis Urutan Kunjungan
        pdf.setFontSize(9);
        pdf.text("Urutan Kunjungan:", margin, currentY);
        currentY += 5;
        const seqText = route.sequence.join(" -> ");
        // Split text agar tidak menabrak batas kanan
        const splitText = pdf.splitTextToSize(seqText, contentWidth);
        pdf.text(splitText, margin, currentY);
      }

      // Kembalikan state highlight seperti semula
      setHighlightedVehicle(prevHighlight);

      // Simpan File
      pdf.save("laporan-rute-detail.pdf");
      toast({ title: "PDF Berhasil Diekspor" });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Gagal Export PDF",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setExportStatus("");
    }
  };

  const applyGroup = (group: Group) => {
    if (!group.nodeIds || group.nodeIds.length === 0) {
      toast({ title: "Group Kosong", variant: "destructive" });
      return;
    }
    setSelected(new Set(group.nodeIds));
    toast({ title: "Group Diterapkan", description: `${group.name}` });
  };

  const summary = useMemo(() => {
    if (!data) return null;
    const totRoute = data.routes.length;
    const totSeq = data.routes.reduce((s, r) => s + r.sequence.length, 0);
    return { totRoute, totSeq };
  }, [data]);

  const canRun = !isPending && maxVehicles > 0 && selected.size > 0;

  const filteredGroups = useMemo(() => {
    if (!groupsQ.data) return [];
    return groupsQ.data.filter((g) =>
      groupQuery.trim()
        ? g.name.toLowerCase().includes(groupQuery.toLowerCase())
        : true
    );
  }, [groupsQ.data, groupQuery]);

  // Progress bar simulasi
  useEffect(() => {
    let progressTimer: ReturnType<typeof setInterval> | undefined;
    let elapsedTimer: ReturnType<typeof setInterval> | undefined;

    if (isPending) {
      setProgress(0);
      setElapsedSec(0);
      progressTimer = setInterval(() => {
        setProgress((prev) => (prev >= 90 ? 90 : prev + 2));
      }, 300);
      elapsedTimer = setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (progressTimer) clearInterval(progressTimer);
      if (elapsedTimer) clearInterval(elapsedTimer);
      setProgress(0);
      setElapsedSec(0);
    };
  }, [isPending]);

  return (
    <section className="space-y-6 p-1">
      {/* ====== HEADER HALAMAN ====== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Optimasi Rute</h1>
          <p className="text-muted-foreground">
            Pilih titik taman, atur parameter, dan jalankan kalkulasi rute.
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
          <ListChecks className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Titik Dipilih:</span>
          <Badge variant="default" className="text-base px-3 py-1">
            {selected.size}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ====== KIRI: MAP (SELEKSI ATAU HASIL) ====== */}
        <div className="lg:col-span-7" ref={mapRef}>
          <Card className="h-full min-h-[600px] flex flex-col relative">
            <CardHeader className="flex-row items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">
                  {data ? "Peta Hasil Rute" : "Peta Titik Taman"}
                </CardTitle>
              </div>
              {!data && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Pilih Semua
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearAll}>
                    Bersihkan
                  </Button>
                </div>
              )}
            </CardHeader>

            {/* Overlay saat Export PDF */}
            {isExporting && (
              <div className="absolute inset-0 z-50 bg-background/80 flex flex-col items-center justify-center backdrop-blur-sm rounded-lg">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <h3 className="text-lg font-semibold">{exportStatus}</h3>
                <p className="text-sm text-muted-foreground">
                  Mohon jangan ubah tampilan...
                </p>
              </div>
            )}

            <CardContent className="flex-1 p-0 flex flex-col relative">
              {nodesQ.isLoading && (
                <Alert className="m-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertTitle>Memuat Data Peta</AlertTitle>
                  <AlertDescription>
                    Sedang mengambil data titik taman...
                  </AlertDescription>
                </Alert>
              )}
              {nodesQ.isError && (
                <Alert variant="destructive" className="m-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Gagal Memuat</AlertTitle>
                  <AlertDescription>
                    Tidak dapat mengambil data titik.
                  </AlertDescription>
                </Alert>
              )}
              {nodesQ.data && (
                <div className="flex-1 w-full h-full min-h-[500px]">
                  {data ? (
                    <OptimizeResultMap
                      nodes={nodesQ.data as Node[]}
                      result={data}
                      routeGeometries={routeGeometries}
                      highlightedVehicleId={highlightedVehicle}
                    />
                  ) : (
                    <NodesMapSelector
                      nodes={nodesQ.data as Node[]}
                      selected={selected}
                      onToggle={toggle}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ====== KANAN: KONTROL (TABS) ====== */}
        <div className="lg:col-span-5">
          <Tabs defaultValue="settings" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="settings">
                <Settings className="mr-2 h-4 w-4" /> Pengaturan
              </TabsTrigger>
              <TabsTrigger value="groups">
                <Users className="mr-2 h-4 w-4" /> Groups
              </TabsTrigger>
            </TabsList>

            {/* --- TAB 1: PENGATURAN & HASIL --- */}
            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Parameter Optimasi
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="max-vehicles">Jumlah Mobil</Label>
                    <Input
                      id="max-vehicles"
                      type="number"
                      min={1}
                      value={maxVehicles}
                      onChange={(e) =>
                        setMaxVehicles(Math.max(1, Number(e.target.value)))
                      }
                      className="text-base font-medium"
                    />
                    <p className="text-xs text-muted-foreground">
                      Jumlah maksimum mobil penyiram yang tersedia.
                    </p>
                  </div>
                  <Separator />
                  <Button
                    size="lg"
                    className="w-full"
                    disabled={!canRun || isPending}
                    onClick={handleRun}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Menghitung...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Jalankan Optimasi
                      </>
                    )}
                  </Button>

                  {isPending && (
                    <div className="space-y-2 pt-2 text-center">
                      <Progress value={progress} className="w-full" />
                      <p className="text-sm text-muted-foreground">
                        Sedang menghitung rute… ({elapsedSec}s)
                      </p>
                    </div>
                  )}

                  {optimizeError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>
                        {(optimizeError as any)?.message}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Ringkasan & Aksi Hasil */}
              <AnimatePresence>
                {data && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card ref={summaryRef}>
                      <CardHeader className="py-4 flex-row items-center justify-between gap-2">
                        <CardTitle className="text-base">
                          Ringkasan Hasil
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportPDF}
                            disabled={isExporting}
                          >
                            {isExporting ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <FileDown className="h-4 w-4 mr-1" />
                            )}
                            PDF
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClearResult}
                            title="Hapus hasil"
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Bersihkan
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="text-sm space-y-3">
                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                          <span className="text-muted-foreground">
                            Total Waktu
                          </span>
                          <b className="text-lg text-primary">
                            {data.objective_time_min} min
                          </b>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">
                            Mobil Terpakai
                          </span>
                          <b>
                            {data.vehicle_used} / {maxVehicles}
                          </b>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Alert Loading Routes */}
              {isFetchingRoutes && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Alert className="bg-muted/50">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertTitle>Memuat Rute Jalan...</AlertTitle>
                    <AlertDescription>
                      Mengambil geometri jalan raya...
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </TabsContent>

            {/* --- TAB 2: GROUPS --- */}
            <TabsContent value="groups">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Grup Tersimpan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari group…"
                      value={groupQuery}
                      onChange={(e) => setGroupQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <ScrollArea className="h-72 rounded-md border p-2">
                    {filteredGroups.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground p-4">
                        Tidak ada grup ditemukan.
                      </p>
                    )}
                    {filteredGroups.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md mb-1"
                      >
                        <div className="overflow-hidden">
                          <div className="font-medium truncate">{g.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {g.nodeIds.length} titik
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => applyGroup(g)}
                        >
                          Pilih
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ====== BAWAH: TABEL RUTE ====== */}
      <AnimatePresence>
        {data?.routes?.length ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="overflow-hidden" ref={tableRef}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-3">
                  <ListTree className="h-5 w-5 text-primary" />
                  Detail Rute per Kendaraan
                </CardTitle>
                <CardDescription>
                  Klik ikon mata untuk menonjolkan rute kendaraan tertentu di
                  peta.
                </CardDescription>
              </CardHeader>
              <div className="max-w-full overflow-x-auto">
                <Table className="min-w-[960px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Warna</TableHead>
                      <TableHead className="w-[120px]">Mobil</TableHead>
                      <TableHead className="w-[150px]">Total Waktu</TableHead>
                      <TableHead>Urutan (Sequence)</TableHead>
                      <TableHead className="w-[100px] text-center">
                        Aksi
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.routes.map((r, idx) => {
                      // Tentukan warna berdasarkan index agar sama dengan Map
                      const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
                      const isHighlighted = highlightedVehicle === r.vehicle_id;
                      // Jika ada yang di-highlight tapi bukan baris ini, buat agak transparan
                      const isDimmed =
                        highlightedVehicle !== null && !isHighlighted;

                      return (
                        <TableRow
                          key={r.vehicle_id}
                          className={
                            isDimmed
                              ? "opacity-40 transition-opacity"
                              : "transition-opacity"
                          }
                        >
                          <TableCell>
                            <div
                              className="w-6 h-6 rounded-full border border-white shadow-sm"
                              style={{ backgroundColor: color }}
                              title={`Warna Rute Mobil #${r.vehicle_id}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4 text-muted-foreground" />
                              #{r.vehicle_id}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {r.total_time_min} min
                          </TableCell>
                          <TableCell className="font-mono text-xs break-all text-muted-foreground">
                            {r.sequence.join(" → ")}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant={isHighlighted ? "default" : "outline"}
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                setHighlightedVehicle(
                                  isHighlighted ? null : r.vehicle_id
                                )
                              }
                              title={
                                isHighlighted
                                  ? "Matikan Highlight"
                                  : "Highlight Rute Ini"
                              }
                            >
                              {isHighlighted ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableCaption className="text-xs">
                    {summary
                      ? `${summary.totRoute} rute • ${summary.totSeq} total kunjungan`
                      : `${data.routes.length} rute`}
                  </TableCaption>
                </Table>
              </div>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
