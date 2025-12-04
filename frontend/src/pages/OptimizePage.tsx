// src/pages/OptimizePage.tsx
import { useMemo, useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Api } from "../lib/api";
import type { OptimizeResponse, Node, Group, Geometry } from "../types";
import { minutesToHHMM } from "../lib/format";
import NodesMapSelector from "../components/NodesMapSelector";
import { useUI } from "../stores/ui";
import { useOptimizeMem } from "../stores/optimize";
import { motion, AnimatePresence } from "framer-motion";

import OptimizeResultMap from "../components/OptimizeResultMap";
import { useAllNodes } from "../hooks/useAllNodes";

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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

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

const ROUTE_COLORS = [
    "#1d4ed8",
    "#c026d3",
    "#db2777",
    "#ea580c",
    "#ca8a04",
    "#059669",
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function OptimizePage() {
    const {
        data: nodes = [],
        isLoading: isLoadingNodes,
        isError: isErrorNodes,
    } = useAllNodes();
    const groupsQ = useQuery<Group[]>({
        queryKey: ["groups"],
        queryFn: Api.listGroups,
    });

    const { maxVehicles, setMaxVehicles, selected, setSelected } = useUI();

    const [vehicleRoutes, setVehicleRoutes] = useState<
        Record<number, Geometry[]>
    >({});
    const [isFetchingRoutes, setIsFetchingRoutes] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const [highlightedVehicleId, setHighlightedVehicleId] = useState<
        number | null
    >(null);

    const mapRef = useRef<HTMLDivElement>(null);
    const summaryRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLDivElement>(null);

    const displayNodes = useMemo(() => {
        return nodes.filter((node) => node.id !== "0" && node.kind === "park");
    }, [nodes]);

    const nodesById = useMemo(
        () => new Map(nodes.map((n) => [n.id, n])),
        [nodes]
    );

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
            /* ... */
        },
    });

    const data: OptimizeResponse | undefined = optimizeData ?? lastResult;

    const clearAll = () => {
        setSelected(new Set());
        clearLastResult();
        setVehicleRoutes({});
        setHighlightedVehicleId(null);
        resetOptimize();
    };

    const handleRun = () => {
        const node_ids = Array.from(selected);
        setVehicleRoutes({});
        setHighlightedVehicleId(null);
        resetOptimize();
        mutate({
            num_vehicles: maxVehicles,
            selected_node_ids: node_ids,
        });
    };

    // LOGIKA FETCHING OSRM
    useEffect(() => {
        if (data && nodesById.size > 0) {
            const fetchGeometries = async () => {
                setIsFetchingRoutes(true);
                setVehicleRoutes({});

                const newRoutes: Record<number, Geometry[]> = {};

                for (const route of data.routes) {
                    const vehId = route.vehicle_id;
                    newRoutes[vehId] = [];

                    for (let i = 0; i < route.sequence.length - 1; i++) {
                        const idA = route.sequence[i].split("#")[0];
                        const idB = route.sequence[i + 1].split("#")[0];

                        const nodeA = nodesById.get(idA);
                        const nodeB = nodesById.get(idB);

                        if (nodeA && nodeB) {
                            try {
                                const geometry = await Api.getRouteGeometry(
                                    nodeA.lon,
                                    nodeA.lat,
                                    nodeB.lon,
                                    nodeB.lat
                                );
                                newRoutes[vehId].push(geometry);

                                setVehicleRoutes((prev) => ({
                                    ...prev,
                                    [vehId]: [...newRoutes[vehId]],
                                }));

                                await sleep(50);
                            } catch (err) {
                                console.error(
                                    `Gagal segmen ${idA}->${idB}`,
                                    err
                                );
                            }
                        }
                    }
                }
                setIsFetchingRoutes(false);
            };
            fetchGeometries();
        }
    }, [data, nodesById, toast]);

    const handleClearResult = () => {
        clearLastResult();
        setVehicleRoutes({});
        setHighlightedVehicleId(null);
        resetOptimize();
    };

    // ============================================================
    // 👇 FUNGSI EXPORT PDF DIPERBAIKI LAGI (LAYOUT LEBIH RAPI) 👇
    // ============================================================
    const handleExportPDF = async () => {
        if (!mapRef.current || !data) return;

        const previousHighlight = highlightedVehicleId;
        setIsExporting(true);

        try {
            const { default: jsPDF } = await import("jspdf");
            const { default: html2canvas } = await import("html2canvas");

            const pdf = new jsPDF("p", "mm", "a4");
            const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
            const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
            const margin = 15;
            const contentWidth = pageWidth - margin * 2;
            let currentY = margin;

            // --- HALAMAN 1: HEADER UTAMA ---
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(20);
            pdf.setTextColor(33, 33, 33);
            pdf.text("Laporan Optimasi MetaVRP", margin, currentY);
            currentY += 10;

            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.5);
            pdf.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 10;

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(11);
            pdf.setTextColor(60, 60, 60);

            const dateStr = new Date().toLocaleDateString("id-ID", {
                dateStyle: "full",
            });
            pdf.text(`Tanggal Laporan : ${dateStr}`, margin, currentY);
            currentY += 6;
            pdf.text(
                `Total Kendaraan : ${data.vehicle_used} Unit`,
                margin,
                currentY
            );
            currentY += 6;
            pdf.text(
                `Total Waktu : ${
                    data.objective_time_min
                } menit (${minutesToHHMM(data.objective_time_min)})`,
                margin,
                currentY
            );
            currentY += 10;

            // --- LOOP SETIAP RUTE ---
            for (let i = 0; i < data.routes.length; i++) {
                const route = data.routes[i];

                // 1. Isolasi Peta
                setHighlightedVehicleId(route.vehicle_id);
                await sleep(800);

                // 2. Screenshot Peta
                const mapCanvas = await html2canvas(mapRef.current, {
                    useCORS: true,
                    scale: 2,
                    backgroundColor: "#ffffff",
                    ignoreElements: (el) =>
                        el.classList.contains("leaflet-control-container"),
                });

                const mapImgData = mapCanvas.toDataURL("image/png");
                const mapImgProps = pdf.getImageProperties(mapImgData);
                const mapHeight =
                    (mapImgProps.height * contentWidth) / mapImgProps.width;

                // Cek halaman baru
                if (currentY + mapHeight + 50 > pageHeight) {
                    pdf.addPage();
                    currentY = margin;
                }

                // Header Rute (Background Abu-abu muda)
                pdf.setFillColor(245, 245, 245);
                pdf.rect(margin, currentY, contentWidth, 10, "F");

                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(12);
                pdf.setTextColor(0, 0, 0);
                pdf.text(
                    `Rute Kendaraan #${route.vehicle_id}`,
                    margin + 3,
                    currentY + 7
                );
                currentY += 15;

                // Gambar Peta
                pdf.addImage(
                    mapImgData,
                    "PNG",
                    margin,
                    currentY,
                    contentWidth,
                    mapHeight
                );
                currentY += mapHeight + 8;

                // Detail Statistik
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(10);
                pdf.text("Statistik & Muatan:", margin, currentY);
                currentY += 5;

                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(10);
                pdf.setTextColor(50, 50, 50);
                pdf.text(
                    `• Total Waktu: ${
                        route.total_time_min
                    } menit (${minutesToHHMM(route.total_time_min)})`,
                    margin + 5,
                    currentY
                );
                currentY += 5;

                // --- PERBAIKAN TAMPILAN PROFIL MUATAN ---
                // Gunakan koma agar lebih ringkas dan mudah dibaca
                const loadStr = route.load_profile_liters.join(", ");
                const loadPrefix = "• Profil Muatan (L): ";
                const fullLoadText = loadPrefix + "[ " + loadStr + " ]";

                // Split text agar tidak keluar margin
                const splitLoad = pdf.splitTextToSize(
                    fullLoadText,
                    contentWidth - 5
                );
                pdf.text(splitLoad, margin + 5, currentY);

                // Spasi lebih ketat (5mm per baris)
                currentY += splitLoad.length * 5 + 4;

                // Cek space lagi untuk Urutan
                if (currentY + 20 > pageHeight) {
                    pdf.addPage();
                    currentY = margin;
                }

                // Urutan Kunjungan
                pdf.setFont("helvetica", "bold");
                pdf.setTextColor(0, 0, 0);
                pdf.text("Urutan Kunjungan:", margin, currentY);
                currentY += 6;

                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(9); // Font 9pt agar pas
                pdf.setTextColor(40, 40, 40);

                // Tulis per baris (List) agar rapi
                route.sequence.forEach((id, idx) => {
                    const rawId = id.split("#")[0];
                    const node = nodesById.get(rawId);
                    const nodeName = node?.name ?? rawId;

                    let extraInfo = "";
                    if (node?.kind === "depot") extraInfo = " [DEPOT]";
                    else if (node?.kind === "refill") extraInfo = " [REFILL]";
                    else if (node?.demand)
                        extraInfo = ` (Butuh: ${node.demand.toLocaleString()} L)`;

                    const lineText = `${idx + 1}. ${nodeName}${extraInfo}`;

                    // Cek halaman penuh sebelum menulis baris
                    if (currentY + 5 > pageHeight - margin) {
                        pdf.addPage();
                        currentY = margin;
                    }

                    pdf.text(lineText, margin + 5, currentY);
                    currentY += 5; // Spasi antar baris (5mm)
                });

                currentY += 10; // Margin bawah antar rute
            }

            // Footer Nomor Halaman
            const pageCount = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                pdf.setPage(i);
                pdf.setFontSize(8);
                pdf.setTextColor(150);
                pdf.text(
                    `Halaman ${i} dari ${pageCount}`,
                    pageWidth - margin,
                    pageHeight - 8,
                    { align: "right" }
                );
            }

            pdf.save("laporan-rute-metavrp.pdf");
        } catch (err) {
            console.error("Export error:", err);
            toast({ title: "Gagal Export PDF", variant: "destructive" });
        } finally {
            setHighlightedVehicleId(previousHighlight);
            setIsExporting(false);
        }
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
            groupQuery.trim() ? g.name.includes(groupQuery) : true
        );
    }, [groupsQ.data, groupQuery]);

    useEffect(() => {
        let timer: NodeJS.Timeout | undefined;
        if (isPending) {
            setProgress(0);
            const interval = 300;
            const totalDuration = 30 * 1000;
            const increment = (interval / totalDuration) * 100;
            timer = setInterval(() => {
                setProgress((prev) => {
                    const newProgress = prev + increment;
                    if (newProgress >= 100) {
                        clearInterval(timer);
                        return 100;
                    }
                    return newProgress;
                });
            }, interval);
        }
        return () => {
            clearInterval(timer);
            if (!isPending) setProgress(0);
        };
    }, [isPending]);

    return (
        <section className="space-y-6 p-1">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Optimasi Rute
                    </h1>
                    <p className="text-muted-foreground">
                        Pilih titik taman, atur parameter, dan jalankan
                        kalkulasi rute.
                    </p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-3">
                    <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                        <ListChecks className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">Titik Dipilih:</span>
                        <Badge
                            variant="default"
                            className="text-base px-3 py-1"
                        >
                            {selected.size}
                        </Badge>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Kiri: Peta */}
                <div className="lg:col-span-7" ref={mapRef}>
                    <Card className="h-full min-h-[600px] flex flex-col">
                        <CardHeader className="flex-row items-center justify-between">
                            <div className="flex items-center gap-3">
                                <MapPin className="h-5 w-5 text-primary" />
                                <CardTitle className="text-lg">
                                    {data
                                        ? "Peta Hasil Rute"
                                        : "Peta Titik Taman"}
                                </CardTitle>
                            </div>
                            {!data && (
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={selectAll}
                                    >
                                        Pilih Semua
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearAll}
                                    >
                                        Bersihkan
                                    </Button>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="flex-1 pt-0 flex flex-col">
                            {isLoadingNodes && (
                                <Alert className="mt-4">
                                    <Loader2 className="animate-spin" />
                                    <AlertTitle>Loading</AlertTitle>
                                </Alert>
                            )}
                            {isErrorNodes && (
                                <Alert variant="destructive" className="mt-4">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Error</AlertTitle>
                                </Alert>
                            )}
                            {nodes.length > 0 && (
                                <div className="flex-1 rounded-lg border overflow-hidden">
                                    {data ? (
                                        <OptimizeResultMap
                                            nodes={nodes}
                                            result={data}
                                            vehicleRoutes={vehicleRoutes}
                                            highlightedVehicleId={
                                                highlightedVehicleId
                                            }
                                            showOnlyHighlighted={isExporting} // Mode isolasi saat export
                                        />
                                    ) : (
                                        <NodesMapSelector
                                            nodes={nodes}
                                            selected={selected}
                                            onToggle={toggle}
                                        />
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Kanan: Kontrol */}
                <div className="lg:col-span-5">
                    <Tabs defaultValue="settings" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="settings">
                                <Settings className="mr-2 h-4 w-4" />
                                Pengaturan
                            </TabsTrigger>
                            <TabsTrigger value="groups">
                                <Users className="mr-2 h-4 w-4" />
                                Groups
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="settings" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        Parameter Optimasi
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="max-vehicles">
                                            Jumlah Mobil
                                        </Label>
                                        <Input
                                            id="max-vehicles"
                                            type="number"
                                            min={1}
                                            value={maxVehicles}
                                            onChange={(e) =>
                                                setMaxVehicles(
                                                    Math.max(
                                                        1,
                                                        Number(e.target.value)
                                                    )
                                                )
                                            }
                                        />
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
                                                <Loader2 className="animate-spin mr-2" />
                                                Running...
                                            </>
                                        ) : (
                                            <>
                                                <Play className="mr-2" />
                                                Run Optimize
                                            </>
                                        )}
                                    </Button>
                                    {isPending && (
                                        <div className="space-y-2 pt-2 text-center">
                                            <Progress
                                                value={progress}
                                                className="w-full"
                                            />
                                            <p className="text-sm text-muted-foreground">
                                                Estimasi: 30s...
                                            </p>
                                        </div>
                                    )}
                                    {optimizeError && (
                                        <Alert variant="destructive">
                                            <AlertTitle>Gagal</AlertTitle>
                                        </Alert>
                                    )}
                                </CardContent>
                            </Card>

                            <AnimatePresence>
                                {data && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        ref={summaryRef}
                                    >
                                        <Card>
                                            <CardHeader className="py-4 flex-row items-center justify-between gap-2">
                                                <CardTitle className="text-base">
                                                    Ringkasan Hasil
                                                </CardTitle>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={
                                                            handleExportPDF
                                                        }
                                                        disabled={isExporting}
                                                    >
                                                        {isExporting ? (
                                                            <Loader2 className="animate-spin h-4 w-4" />
                                                        ) : (
                                                            <FileDown className="h-4 w-4 mr-1" />
                                                        )}{" "}
                                                        PDF
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={
                                                            handleClearResult
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-1" />
                                                        Bersihkan
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="text-sm space-y-3">
                                                <div className="flex justify-between p-3 bg-muted/50 rounded-md">
                                                    <span>Total Waktu</span>
                                                    <b>
                                                        {
                                                            data.objective_time_min
                                                        }{" "}
                                                        min
                                                    </b>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Mobil Terpakai</span>
                                                    <b>{data.vehicle_used}</b>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {isFetchingRoutes && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    <Alert className="bg-muted/50">
                                        <Loader2 className="animate-spin h-4 w-4" />
                                        <AlertTitle>
                                            Memuat Rute Jalan...
                                        </AlertTitle>
                                    </Alert>
                                </motion.div>
                            )}
                        </TabsContent>
                        <TabsContent value="groups">
                            {/* ... Tab Groups ... */}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Bawah: Tabel Detail */}
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
                                    Detail Rute
                                </CardTitle>
                            </CardHeader>
                            <div className="max-w-full overflow-x-auto">
                                <Table className="min-w-[960px]">
                                    <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur">
                                        <TableRow>
                                            <TableHead className="w-[120px]">
                                                Mobil
                                            </TableHead>
                                            <TableHead className="w-[150px]">
                                                Total Waktu
                                            </TableHead>
                                            <TableHead>
                                                Urutan (Sequence)
                                            </TableHead>
                                            <TableHead className="w-[260px]">
                                                Ringkasan Rute
                                            </TableHead>
                                            <TableHead className="w-[100px] text-right">
                                                Aksi
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.routes.map((r, index) => {
                                            const color =
                                                ROUTE_COLORS[
                                                    index % ROUTE_COLORS.length
                                                ];
                                            const isHighlighted =
                                                highlightedVehicleId ===
                                                r.vehicle_id;
                                            return (
                                                <TableRow
                                                    key={r.vehicle_id}
                                                    className={
                                                        isHighlighted
                                                            ? "bg-muted/50"
                                                            : ""
                                                    }
                                                >
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="w-3 h-3 rounded-full shadow-sm"
                                                                style={{
                                                                    backgroundColor:
                                                                        color,
                                                                }}
                                                            ></div>
                                                            #{r.vehicle_id}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {r.total_time_min} min
                                                    </TableCell>
                                                    <TableCell className="text-xs break-all">
                                                        {r.sequence.map(
                                                            (id, idx) => {
                                                                const [
                                                                    rawId,
                                                                    visitSuffix,
                                                                ] =
                                                                    id.split(
                                                                        "#"
                                                                    );
                                                                const node =
                                                                    nodesById.get(
                                                                        rawId
                                                                    );
                                                                const nodeName =
                                                                    node?.name ??
                                                                    rawId;

                                                                const visitNum =
                                                                    visitSuffix
                                                                        ? Number(
                                                                              visitSuffix
                                                                          )
                                                                        : null;

                                                                return (
                                                                    <span
                                                                        key={id}
                                                                        className="inline-flex items-center gap-1 mr-1"
                                                                    >
                                                                        {idx >
                                                                            0 && (
                                                                            <span className="mx-1">
                                                                                →
                                                                            </span>
                                                                        )}

                                                                        {/* Nama titik */}
                                                                        <span>
                                                                            {
                                                                                nodeName
                                                                            }
                                                                        </span>

                                                                        {/* Badge kecil kalau ini kunjungan ke-2, ke-3, dst */}
                                                                        {visitNum &&
                                                                            visitNum >
                                                                                1 && (
                                                                                <span className="text-[10px] px-1 py-[1px] rounded-full border border-muted-foreground/40 text-muted-foreground">
                                                                                    ke-
                                                                                    {
                                                                                        visitNum
                                                                                    }
                                                                                </span>
                                                                            )}
                                                                    </span>
                                                                );
                                                            }
                                                        )}
                                                    </TableCell>

                                                    <TableCell className="text-xs">
                                                        {(() => {
                                                            // mapping id -> node
                                                            const nodesOnRoute =
                                                                r.sequence
                                                                    .map((id) =>
                                                                        nodesById.get(
                                                                            id.split(
                                                                                "#"
                                                                            )[0]
                                                                        )
                                                                    )
                                                                    .filter(
                                                                        (
                                                                            n
                                                                        ): n is Node =>
                                                                            Boolean(
                                                                                n
                                                                            )
                                                                    );

                                                            // total titik (exclude depot kalau mau)
                                                            const stops =
                                                                nodesOnRoute.filter(
                                                                    (n) =>
                                                                        n.kind !==
                                                                        "depot"
                                                                ).length;

                                                            // jumlah refill
                                                            const refillCount =
                                                                nodesOnRoute.filter(
                                                                    (n) =>
                                                                        n.kind ===
                                                                        "refill"
                                                                ).length;

                                                            // total demand air (L) di taman
                                                            const totalDemand =
                                                                nodesOnRoute
                                                                    .filter(
                                                                        (n) =>
                                                                            n.kind ===
                                                                            "park"
                                                                    )
                                                                    .reduce(
                                                                        (
                                                                            sum,
                                                                            n
                                                                        ) =>
                                                                            sum +
                                                                            (n.demand ??
                                                                                0),
                                                                        0
                                                                    );

                                                            // max load dari profil muatan (kalau mau dipakai)
                                                            const maxLoad =
                                                                r
                                                                    .load_profile_liters
                                                                    .length > 0
                                                                    ? Math.max(
                                                                          ...r.load_profile_liters
                                                                      )
                                                                    : 0;

                                                            return (
                                                                <div className="flex flex-wrap gap-2">
                                                                    <span className="inline-flex items-center rounded-full border px-2 py-[2px] text-[11px]">
                                                                        🏁{" "}
                                                                        {stops}{" "}
                                                                        titik
                                                                    </span>
                                                                    <span className="inline-flex items-center rounded-full border px-2 py-[2px] text-[11px]">
                                                                        💧{" "}
                                                                        {totalDemand.toLocaleString(
                                                                            "id-ID"
                                                                        )}{" "}
                                                                        L
                                                                        disiram
                                                                    </span>
                                                                    <span className="inline-flex items-center rounded-full border px-2 py-[2px] text-[11px]">
                                                                        ♻️{" "}
                                                                        {
                                                                            refillCount
                                                                        }{" "}
                                                                        refill
                                                                    </span>
                                                                    {/* Optional: kalau mau tampilkan juga maksimum muatan yang pernah dibawa */}
                                                                    {/*
        <span className="inline-flex items-center rounded-full border px-2 py-[2px] text-[11px]">
          📦 max {maxLoad.toLocaleString("id-ID")} L
        </span>
        */}
                                                                </div>
                                                            );
                                                        })()}
                                                    </TableCell>

                                                    <TableCell className="text-right">
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger
                                                                    asChild
                                                                >
                                                                    <Button
                                                                        variant={
                                                                            isHighlighted
                                                                                ? "default"
                                                                                : "ghost"
                                                                        }
                                                                        size="icon"
                                                                        className="h-8 w-8"
                                                                        onClick={() =>
                                                                            setHighlightedVehicleId(
                                                                                isHighlighted
                                                                                    ? null
                                                                                    : r.vehicle_id
                                                                            )
                                                                        }
                                                                    >
                                                                        {isHighlighted ? (
                                                                            <Eye className="h-4 w-4" />
                                                                        ) : (
                                                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                                        )}
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>
                                                                        {isHighlighted
                                                                            ? "Matikan Highlight"
                                                                            : "Lihat Rute"}
                                                                    </p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </section>
    );
}
