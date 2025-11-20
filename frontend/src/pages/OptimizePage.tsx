// src/pages/OptimizePage.tsx
import { useMemo, useState, useEffect, useRef } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Api } from "../lib/api"
import type { OptimizeResponse, Node, Group } from "../types"
import { minutesToHHMM } from "../lib/format"
import NodesMapSelector from "../components/NodesMapSelector"
import { useUI } from "../stores/ui"
import { useOptimizeMem } from "../stores/optimize"
import { motion, AnimatePresence } from "framer-motion"
import type { Geometry } from "geojson"

// Peta hasil
import OptimizeResultMap from "../components/OptimizeResultMap"

// --- SHADCN UI ---
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"

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
} from "lucide-react"

// Helper kecil
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default function OptimizePage() {
  // data nodes & groups
  const nodesQ = useQuery({ queryKey: ["nodes"], queryFn: Api.listNodes })
  const groupsQ = useQuery<Group[]>({ queryKey: ["groups"], queryFn: Api.listGroups })

  // selection titik
  const { maxVehicles, setMaxVehicles, selected, setSelected } = useUI()

  // State untuk OSRM
  const [routeGeometries, setRouteGeometries] = useState<Geometry[]>([])
  const [isFetchingRoutes, setIsFetchingRoutes] = useState(false)

  // State untuk PDF
  const [isExporting, setIsExporting] = useState(false)

  // Refs untuk elemen PDF
  const mapRef = useRef<HTMLDivElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  // displayNodes
  const displayNodes = useMemo(() => {
    if (!nodesQ.data) return []
    return (nodesQ.data as Node[]).filter(
      node => node.id !== "0" && node.kind === "park",
    )
  }, [nodesQ.data])

  // Peta ID -> Node
  const nodesById = useMemo(() => {
    if (!nodesQ.data) return new Map<string, Node>()
    return new Map((nodesQ.data as Node[]).map(n => [n.id, n]))
  }, [nodesQ.data])

  const toggle = (id: string) => {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }

  const selectAll = () => {
    setSelected(new Set(displayNodes.map((n) => n.id)))
  }

  const { toast } = useToast()
  const { lastResult, setLastResult, clearLastResult } = useOptimizeMem()

  const [groupQuery, setGroupQuery] = useState("")
  const [progress, setProgress] = useState(0)
  const [elapsedSec, setElapsedSec] = useState(0) // NEW: waktu berjalan

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
      })
      toast({
        title: "Optimisasi Selesai",
        description: `Objective ${res.objective_time_min} menit (${minutesToHHMM(
          res.objective_time_min,
        )})`,
        action: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      })
    },
    onError: (err: any) => {
      console.error("Optimize error:", err)
      toast({
        title: "Optimasi Gagal",
        description:
          err?.response?.data?.detail ??
          err?.message ??
          "Terjadi kesalahan saat menjalankan optimasi.",
        variant: "destructive",
      })
    },
  })

  // 'data' adalah hasil optimasi (mutasi atau dari memori)
  const data: OptimizeResponse | undefined = optimizeData ?? lastResult

  // clear semua (selection + hasil + geometries + state mutasi)
  const clearAll = () => {
    setSelected(new Set())
    clearLastResult()
    setRouteGeometries([])
    resetOptimize()
  }

  // Run optimasi
  const handleRun = () => {
    const node_ids = Array.from(selected)
    setRouteGeometries([])
    resetOptimize()
    mutate({
      num_vehicles: maxVehicles,
      selected_node_ids: node_ids,
    })
  }

  // Efek ambil OSRM geometry
  useEffect(() => {
    if (data && nodesById.size > 0) {
      const fetchGeometries = async () => {
        setIsFetchingRoutes(true)
        setRouteGeometries([])
        const geometries: Geometry[] = []
        for (const route of data.routes) {
          for (let i = 0; i < route.sequence.length - 1; i++) {
            const nodeA = nodesById.get(route.sequence[i])
            const nodeB = nodesById.get(route.sequence[i + 1])
            if (nodeA && nodeB) {
              try {
                const geometry = await Api.getRouteGeometry(
                  nodeA.lon,
                  nodeA.lat,
                  nodeB.lon,
                  nodeB.lat,
                )
                geometries.push(geometry)
                setRouteGeometries([...geometries])
                await sleep(50)
              } catch (err) {
                console.error(
                  `Gagal mengambil segmen ${nodeA.id} -> ${nodeB.id}`,
                  err,
                )
              }
            }
          }
        }
        setRouteGeometries(geometries)
        setIsFetchingRoutes(false)
      }
      fetchGeometries()
    }
  }, [data, nodesById, toast])

  // Bersihkan hasil optimasi (tanpa nyentuh selection)
  const handleClearResult = () => {
    clearLastResult()
    setRouteGeometries([])
    resetOptimize()
  }

  // Export PDF
  const handleExportPDF = async () => {
    if (!mapRef.current || !summaryRef.current || !tableRef.current) {
      toast({
        title: "Elemen laporan belum siap, coba lagi",
        variant: "destructive",
      })
      return
    }

    setIsExporting(true)

    try {
      const { default: jsPDF } = await import("jspdf")
      const { default: html2canvas } = await import("html2canvas")

      const pdf = new jsPDF("p", "mm", "a4")
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 10
      const contentWidth = pageWidth - margin * 2
      let currentY = margin

      pdf.setFontSize(18)
      pdf.text("Laporan Hasil Optimasi Rute", margin, currentY)
      currentY += 10

      // 1. Map
      const mapCanvas = await html2canvas(mapRef.current, {
        useCORS: true,
        ignoreElements: (element) =>
          element.classList.contains("leaflet-control-container"),
      })
      const mapImgData = mapCanvas.toDataURL("image/png")
      const mapImgProps = pdf.getImageProperties(mapImgData)
      const mapHeight =
        (mapImgProps.height * contentWidth) / mapImgProps.width
      pdf.addImage(mapImgData, "PNG", margin, currentY, contentWidth, mapHeight)
      currentY += mapHeight + margin

      // 2. Ringkasan
      const summaryCanvas = await html2canvas(summaryRef.current)
      const summaryImgData = summaryCanvas.toDataURL("image/png")
      const summaryImgProps = pdf.getImageProperties(summaryImgData)
      const summaryHeight =
        (summaryImgProps.height * contentWidth) / summaryImgProps.width

      if (currentY + summaryHeight > pageHeight - margin) {
        pdf.addPage()
        currentY = margin
      }
      pdf.addImage(
        summaryImgData,
        "PNG",
        margin,
        currentY,
        contentWidth,
        summaryHeight,
      )
      currentY += summaryHeight + margin

      // 3. Tabel
      const tableCanvas = await html2canvas(tableRef.current)
      const tableImgData = tableCanvas.toDataURL("image/png")
      const tableImgProps = pdf.getImageProperties(tableImgData)
      const tableHeight =
        (tableImgProps.height * contentWidth) / tableImgProps.width

      if (currentY + tableHeight > pageHeight - margin) {
        pdf.addPage()
        currentY = margin
      }
      pdf.addImage(
        tableImgData,
        "PNG",
        margin,
        currentY,
        contentWidth,
        tableHeight,
      )

      pdf.save("hasil-optimasi-meta-vrp.pdf")
    } catch (err) {
      console.error("Gagal export PDF:", err)
      toast({
        title: "Gagal mengekspor PDF",
        description: (err as Error).message,
        variant: "destructive",
      })
    }

    setIsExporting(false)
  }

  // Terapkan group
  const applyGroup = (group: Group) => {
    if (!group.nodeIds || group.nodeIds.length === 0) {
      toast({
        title: "Group Kosong",
        description: "Group ini tidak memiliki titik lokasi.",
        variant: "destructive",
      })
      return
    }

    const newSelection = new Set(group.nodeIds)
    setSelected(newSelection)

    toast({
      title: "Group Diterapkan",
      description: `Berhasil memilih ${newSelection.size} titik dari group "${group.name}".`,
    })
  }

  // Ringkasan
  const summary = useMemo(() => {
    if (!data) return null
    const totRoute = data.routes.length
    const totSeq = data.routes.reduce(
      (s, r) => s + r.sequence.length,
      0,
    )
    return { totRoute, totSeq }
  }, [data])

  const canRun = !isPending && maxVehicles > 0 && selected.size > 0

  // Filter groups
  const filteredGroups = useMemo(() => {
    if (!groupsQ.data) return []
    return groupsQ.data.filter((g) =>
      groupQuery.trim()
        ? g.name.toLowerCase().includes(groupQuery.toLowerCase())
        : true,
    )
  }, [groupsQ.data, groupQuery])

  // Progress bar: pseudo-indeterminate + elapsed time
  useEffect(() => {
  let progressTimer: ReturnType<typeof setInterval> | undefined
  let elapsedTimer: ReturnType<typeof setInterval> | undefined

  if (isPending) {
    setProgress(0)
    setElapsedSec(0)

    progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90
        return prev + 2
      })
    }, 300)

    elapsedTimer = setInterval(() => {
      setElapsedSec((prev) => prev + 1)
    }, 1000)
  }

  return () => {
    if (progressTimer) clearInterval(progressTimer)
    if (elapsedTimer) clearInterval(elapsedTimer)
    setProgress(0)
    setElapsedSec(0)
  }
}, [isPending])


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
          <Card className="h-full min-h-[600px] flex flex-col">
            <CardHeader className="flex-row items-center justify-between">
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
            <CardContent className="flex-1 pt-0 flex flex-col">
              {nodesQ.isLoading && (
                <Alert className="mt-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertTitle>Memuat Data Peta</AlertTitle>
                  <AlertDescription>
                    Sedang mengambil data titik taman...
                  </AlertDescription>
                </Alert>
              )}
              {nodesQ.isError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Gagal Memuat</AlertTitle>
                  <AlertDescription>
                    Tidak dapat mengambil data titik. Coba refresh halaman.
                  </AlertDescription>
                </Alert>
              )}
              {nodesQ.data && (
                <div className="flex-1 rounded-lg border overflow-hidden">
                  {data ? (
                    <OptimizeResultMap
                      nodes={nodesQ.data as Node[]}
                      result={data}
                      routeGeometries={routeGeometries}
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
                <Settings className="mr-2 h-4 w-4" />
                Pengaturan
              </TabsTrigger>
              <TabsTrigger value="groups">
                <Users className="mr-2 h-4 w-4" />
                Groups
              </TabsTrigger>
            </TabsList>

            {/* --- TAB 1: PENGATURAN & HASIL --- */}
            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Parameter Optimasi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="max-vehicles">Jumlah Mobil (Max Vehicles)</Label>
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
                        Menjalankan Kalkulasi...
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
                      <p className="text-[11px] text-muted-foreground/80">
                        Waktu proses bergantung jumlah titik dan jumlah kendaraan.
                      </p>
                    </div>
                  )}

                  {optimizeError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Optimasi Gagal</AlertTitle>
                      <AlertDescription>
                        {(optimizeError as any)?.response?.data?.detail ??
                          (optimizeError as any)?.message ??
                          "Failed."}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Ringkasan hasil */}
              <AnimatePresence>
                {data && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <Card ref={summaryRef}>
                      <CardHeader className="py-4 flex-row items-center justify-between gap-2">
                        <CardTitle className="text-base">Ringkasan Hasil</CardTitle>
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
                            title="Hapus hasil optimasi terakhir"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Bersihkan
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="text-sm space-y-3">
                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                          <span className="text-muted-foreground">
                            Total Waktu (Objective)
                          </span>
                          <b className="text-lg text-primary">
                            {data.objective_time_min} min (
                            {minutesToHHMM(data.objective_time_min)})
                          </b>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Mobil Terpakai</span>
                          <b>
                            {data.vehicle_used} /{" "}
                            {(lastResult as any)?.params?.num_vehicles ?? maxVehicles}
                          </b>
                        </div>
                        {summary && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">
                              Total Kunjungan
                            </span>
                            <b>{summary.totSeq} titik</b>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Loading OSRM */}
              {isFetchingRoutes && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  <Alert className="bg-muted/50">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertTitle>Memuat Rute Jalan...</AlertTitle>
                    <AlertDescription>
                      Mengambil data rute jalan raya dari server OSRM...
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
                  <CardDescription>
                    Terapkan grup untuk memilih sekumpulan titik dengan cepat.
                  </CardDescription>
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
                  {groupsQ.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground pt-4 justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading groups…
                    </div>
                  ) : groupsQ.isError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Gagal Memuat Grup</AlertTitle>
                    </Alert>
                  ) : (groupsQ.data ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center pt-4">
                      Belum ada group.
                    </p>
                  ) : (
                    <ScrollArea className="h-96 rounded-md border">
                      <div className="p-2">
                        {filteredGroups.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center p-4">
                            Grup tidak ditemukan.
                          </p>
                        )}
                        {filteredGroups.map((g) => (
                          <li
                            key={g.id}
                            className="list-none py-2 px-3 flex items-center justify-between gap-3 rounded-md hover:bg-muted/50"
                          >
                            <div className="min-w-0">
                              <div className="font-medium truncate">{g.name}</div>
                              <div className="text-xs text-muted-foreground flex gap-2">
                                <span>{g.nodeIds?.length ?? 0} points</span>
                                {g.description && (
                                  <>
                                    <span>·</span>
                                    <span className="truncate opacity-80">
                                      {g.description}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => applyGroup(g)}
                              title="Apply group (replace selection)"
                            >
                              Terapkan
                            </Button>
                          </li>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
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
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3, ease: "easeInOut", delay: 0.1 }}
          >
            <Card className="overflow-hidden" ref={tableRef}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-3">
                  <ListTree className="h-5 w-5 text-primary" />
                  Detail Rute per Kendaraan
                </CardTitle>
                <CardDescription>
                  Detail urutan, waktu, dan muatan untuk setiap mobil yang digunakan.
                </CardDescription>
              </CardHeader>
              <div className="max-w-full overflow-x-auto">
                <Table className="min-w-[960px]">
                  <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40">
                    <TableRow>
                      <TableHead className="w-[120px]">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4" /> Mobil
                        </div>
                      </TableHead>
                      <TableHead className="w-[200px]">Total Waktu</TableHead>
                      <TableHead>Urutan (Sequence)</TableHead>
                      <TableHead className="w-[280px]">
                        Profil Muatan (Liter)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.routes.map((r) => (
                      <TableRow key={r.vehicle_id}>
                        <TableCell className="font-medium">
                          #{r.vehicle_id}
                        </TableCell>
                        <TableCell className="font-medium">
                          {r.total_time_min} min (
                          {minutesToHHMM(r.total_time_min)})
                        </TableCell>
                        <TableCell className="font-mono text-xs break-all">
                          {r.sequence.join(" → ")}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          [{r.load_profile_liters.join(", ")}]
                        </TableCell>
                      </TableRow>
                    ))}
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
  )
}
