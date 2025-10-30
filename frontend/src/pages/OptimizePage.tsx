// src/pages/OptimizePage.tsx
import { useMemo, useState, useEffect } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Api } from "../lib/api"
import type { OptimizeResponse, Node, Group } from "../types"
import { minutesToHHMM } from "../lib/format"
import MapWithDraw from "@/components/MapWithDraw"               // NEW
import { useUI } from "../stores/ui"
import { useOptimizeMem } from "../stores/optimize"
import { motion, AnimatePresence } from "framer-motion"

// ── SHADCN UI ───────────────────────────────────────────────────────
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

// ── ICONS ───────────────────────────────────────────────────────────
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
} from "lucide-react"

export default function OptimizePage() {
  // ── DATA ───────────────────────────────────────────────────────
  const nodesQ   = useQuery({ queryKey: ["nodes"],   queryFn: Api.listNodes })
  const groupsQ  = useQuery<Group[]>({ queryKey: ["groups"], queryFn: Api.listGroups })

  // ── UI STATE ───────────────────────────────────────────────────
  const { maxVehicles, setMaxVehicles, selected, setSelected } = useUI()
  const { lastResult, setLastResult, clearLastResult } = useOptimizeMem()
  const [groupQuery, setGroupQuery] = useState("")
  const [progress, setProgress] = useState(0)

  // ── DERIVED NODES (only parks, hide depot) ─────────────────────
  const displayNodes = useMemo(() => {
    if (!nodesQ.data) return []
    return (nodesQ.data as Node[]).filter(n => n.id !== "0" && n.kind === "park")
  }, [nodesQ.data])

  // ── SELECTION HELPERS ───────────────────────────────────────────
  const toggle = (id: string) => {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }
  const selectAll = () => setSelected(new Set(displayNodes.map(n => n.id)))
  const clearAll  = () => setSelected(new Set())

  const applyGroup = (g: Group) => {
    setSelected(new Set(g.nodeIds ?? []))
    toast({
      title: "Grup Diterapkan",
      description: `Memilih ${g.nodeIds?.length ?? 0} titik dari grup "${g.name}".`,
    })
  }

  // ── TOAST ───────────────────────────────────────────────────────
  const { toast } = useToast()

  // ── OPTIMISE MUTATION ───────────────────────────────────────────
  const optimize = useMutation({
    mutationFn: (payload: any) => Api.optimize(payload),
    onSuccess: (res, variables) => {
      setLastResult(res, {
        num_vehicles: variables?.num_vehicles,
        selected_node_ids: variables?.selected_node_ids ?? [],
      })
      toast({
        title: "Optimisasi Selesai",
        description: `Objective ${res.objective_time_min} menit (${minutesToHHMM(res.objective_time_min)})`,
        action: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      })
    },
    onError: (err: any) => {
      toast({
        title: "Gagal menjalankan optimisasi",
        description: err?.response?.data?.detail ?? err?.message ?? "Terjadi kesalahan tak terduga.",
        variant: "destructive",
      })
    },
  })

  const handleRun = () => {
    const node_ids = Array.from(selected)
    optimize.mutate({
      num_vehicles: maxVehicles,
      selected_node_ids: node_ids,
    })
  }

  const data: OptimizeResponse | undefined = optimize.data ?? lastResult

  // ── SUMMARY ─────────────────────────────────────────────────────
  const summary = useMemo(() => {
    if (!data) return null
    const totRoute = data.routes.length
    const totSeq   = data.routes.reduce((s, r) => s + r.sequence.length, 0)
    return { totRoute, totSeq }
  }, [data])

  const canRun = !optimize.isPending && maxVehicles > 0 && selected.size > 0

  // ── FILTERED GROROUPS ───────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    if (!groupsQ.data) return []
    return groupsQ.data.filter(g =>
      groupQuery.trim() ? g.name.toLowerCase().includes(groupQuery.toLowerCase()) : true
    )
  }, [groupsQ.data, groupQuery])

  // ── PROGRESS BAR (30 s fake) ───────────────────────────────────
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined
    if (optimize.isPending) {
      setProgress(0)
      const interval = 300
      const total    = 30_000
      const inc      = (interval / total) * 100

      timer = setInterval(() => {
        setProgress(p => {
          const next = p + inc
          if (next >= 100) { clearInterval(timer); return 100 }
          return next
        })
      }, interval)
    }
    return () => { clearInterval(timer); if (!optimize.isPending) setProgress(0) }
  }, [optimize.isPending])

  // ── RENDER ───────────────────────────────────────────────────────
  return (
    <section className="space-y-6 p-1">
      {/* ── HEADER ── */}
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
        {/* ── LEFT: MAP ── */}
        <div className="lg:col-span-7">
          <Card className="h-full min-h-[600px] flex flex-col">
            <CardHeader className="flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Peta Titik Taman</CardTitle>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Pilih Semua
                </Button>
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  Bersihkan
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 pt-0 flex flex-col">
              {nodesQ.isLoading && (
                <Alert className="mt-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertTitle>Memuat Data Peta</AlertTitle>
                  <AlertDescription>Sedang mengambil data titik taman...</AlertDescription>
                </Alert>
              )}
              {nodesQ.isError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Gagal Memuat</AlertTitle>
                  <AlertDescription>Tidak dapat mengambil data titik. Coba refresh halaman.</AlertDescription>
                </Alert>
              )}

              {/* ── NEW MAP WITH DRAW ── */}
              {nodesQ.data && (
                <div className="flex-1 rounded-lg border overflow-hidden">
                  <MapWithDraw
                    nodes={displayNodes}
                    selected={selected}
                    onToggle={toggle}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: CONTROLS ── */}
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

            {/* ── SETTINGS TAB ── */}
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
                      onChange={e => setMaxVehicles(Math.max(1, Number(e.target.value)))}
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
                    disabled={!canRun || optimize.isPending}
                    onClick={handleRun}
                  >
                    {optimize.isPending ? (
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

                  {optimize.isPending && (
                    <div className="space-y-2 pt-2 text-center">
                      <Progress value={progress} className="w-full" />
                      <p className="text-sm text-muted-foreground">
                        Estimasi waktu: 30 detik... ({Math.round(progress)}%)
                      </p>
                    </div>
                  )}

                  {optimize.isError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Optimasi Gagal</AlertTitle>
                      <AlertDescription>
                        {(optimize.error as any)?.response?.data?.detail ??
                          (optimize.error as any)?.message ??
                          "Failed."}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* ── RESULT SUMMARY ── */}
              <AnimatePresence>
                {data && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <Card>
                      <CardHeader className="py-4 flex-row items-center justify-between">
                        <CardTitle className="text-base">Ringkasan Hasil</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearLastResult}
                          title="Hapus hasil optimasi terakhir"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Bersihkan Hasil
                        </Button>
                      </CardHeader>

                      <CardContent className="text-sm space-y-3">
                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                          <span className="text-muted-foreground">Total Waktu (Objective)</span>
                          <b className="text-lg text-primary">
                            {data.objective_time_min} min ({minutesToHHMM(data.objective_time_min)})
                          </b>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Mobil Terpakai</span>
                          <b>{data.vehicle_used} / {lastResult?.params?.num_vehicles ?? maxVehicles}</b>
                        </div>
                        {summary && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Total Kunjungan</span>
                            <b>{summary.totSeq} titik</b>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>

            {/* ── GROUPS TAB ── */}
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
                      onChange={e => setGroupQuery(e.target.value)}
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
                        {filteredGroups.map(g => (
                          <li
                            key={g.id}
                            className="list-none py-2 px-3 flex items-center justify-between gap-3 rounded-md hover:bg-muted/50"
                          >
                            <div className="min-w-0">
                              <div className="font-medium truncate">{g.name}</div>
                              <div className="text-xs text-muted-foreground flex gap-2">
                                <span>{(g.nodeIds?.length ?? 0)} points</span>
                                {g.description && (
                                  <>
                                    <span>·</span>
                                    <span className="truncate opacity-80">{g.description}</span>
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

      {/* ── ROUTE TABLE ── */}
      <AnimatePresence>
        {data?.routes?.length ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3, ease: "easeInOut", delay: 0.1 }}
          >
            <Card className="overflow-hidden">
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
                        <div className="flex items-center gap-2"><Truck className="h-4 w-4" /> Mobil</div>
                      </TableHead>
                      <TableHead className="w-[200px]">Total Waktu</TableHead>
                      <TableHead>Urutan (Sequence)</TableHead>
                      <TableHead className="w-[280px]">Profil Muatan (Liter)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.routes.map(r => (
                      <TableRow key={r.vehicle_id}>
                        <TableCell className="font-medium">#{r.vehicle_id}</TableCell>
                        <TableCell className="font-medium">
                          {r.total_time_min} min ({minutesToHHMM(r.total_time_min)})
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
