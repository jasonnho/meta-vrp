// src/pages/LogsPage.tsx
import { useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { Api } from "../lib/api"
import type { HistoryItem, JobDetail, JobStatus } from "../types"
import StatusBadge from "../components/StatusBadge"
import { minutesToHHMM } from "../lib/format"
import { useLogsUI } from "../stores/logs"
// --- TAMBAHAN IMPORT BARU ---
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar" // Pastikan ini sudah ter-install
// ----------------------------
// --- SHADCN UI ---
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DialogClose } from "@/components/ui/dialog"
// Hapus import Separator (tidak terpakai)
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input" // Hapus Input jika tidak terpakai (ternyata terpakai di DetailsContent?) -> Biarkan dulu
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader as DialogHeaderUI,
  DialogTitle as DialogTitleUI,
} from "@/components/ui/dialog"
// Hapus import useToast (tidak terpakai)

// --- ICONS ---
import {
  Loader2,
  // Hapus Filter (tidak terpakai)
  Eye,
  History,
  ListFilter,
  CalendarDays,
  X,
  Inbox,
  AlertCircle,
  Clock,
  Truck,
  MapPin,
  Hash,
  // Hapus Calendar Icon (sudah ada komponennya)
  Info,
  Users,
  ListTree,
} from "lucide-react"

// helper: YYYY-MM-DD lokal
function ymdLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const da = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${da}`
}

const STATUS_OPTIONS: Array<{ value: "ALL" | JobStatus, label: string }> = [
  { value: "ALL", label: "Semua Status" },
  { value: "planned", label: "Planned" },
  { value: "running", label: "Running" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
]

export default function LogsPage() {
  const { status, setStatus, fromDate, setFromDate, toDate, setToDate } = useLogsUI()
  const [sp, setSp] = useSearchParams()
  // Hapus toast (tidak terpakai)

  // ===== Sinkronisasi Filter <-> URL =====
  useEffect(() => {
    const s = (sp.get("status") ?? "").toLowerCase()
    const f = sp.get("from") ?? ""
    const t = sp.get("to") ?? ""

    const allowed = STATUS_OPTIONS.map(opt => opt.value)
    const normalized = s ? (allowed.includes(s as any) ? (s as any) : "ALL") : "ALL"

    if (normalized !== status) setStatus(normalized)
    if (f && f !== fromDate) setFromDate(f)
    if (t && t !== toDate) setToDate(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const next = new URLSearchParams(sp)
    if (status && status !== "ALL") next.set("status", status)
    else next.delete("status")

    if (fromDate) next.set("from", fromDate)
    else next.delete("from")

    if (toDate) next.set("to", toDate)
    else next.delete("to")

    setSp(next, { replace: true })
  }, [status, fromDate, toDate, sp, setSp])

  // ===== Data: daftar jobs =====
  const q = useQuery<HistoryItem[]>({
    queryKey: ["jobs-history"],
    queryFn: Api.listHistory,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const rows = useMemo(() => {
    const items = q.data ?? []
    const st = status === "ALL" ? null : String(status).toLowerCase()
    return items.filter((it) => {
      const okStatus = st ? String(it.status).toLowerCase() === st : true
      const d = new Date(it.created_at)
      const dateStr = ymdLocal(d)
      const afterFrom = !fromDate || dateStr >= fromDate
      const beforeTo = !toDate || dateStr <= toDate
      return okStatus && afterFrom && beforeTo
    })
  }, [q.data, status, fromDate, toDate])

  const clearFilters = () => {
    setStatus("ALL")
    setFromDate("")
    setToDate("")
  }

  // ===== Detail via URL ?detail=<jobId> =====
  const selectedId = sp.get("detail")
  const open = !!selectedId

  const detailQ = useQuery<JobDetail>({
    queryKey: ["job-detail", selectedId],
    queryFn: () => Api.getJobDetail(selectedId as string),
    enabled: !!selectedId,
    staleTime: 30_000,
  })

  const openDetail = (id: string) => {
    const next = new URLSearchParams(sp)
    next.set("detail", id)
    setSp(next, { replace: false })
  }
  const closeDetail = () => {
    const next = new URLSearchParams(sp)
    next.delete("detail")
    setSp(next, { replace: true })
  }

  return (
    <section className="space-y-6 p-1">
      {/* ====== HEADER & FILTER ====== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Judul Halaman */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Histori Optimasi</h1>
          <p className="text-muted-foreground">
            Lihat riwayat dari semua proses optimasi yang telah dijalankan.
          </p>
        </div>

        {/* --- PERBAIKI BAGIAN FILTER INI --- */}
        {/* Filter Area */}
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          {/* Filter Status (Tidak berubah) */}
          <div className="space-y-1 w-full sm:w-48">
            <Label htmlFor="filter-status" className="text-xs">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as any)}
            >
              <SelectTrigger id="filter-status">
                <SelectValue placeholder="Filter status..." />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter From Tanggal (Popover + Calendar) */}
          <div className="space-y-1 w-full sm:w-auto">
            <Label htmlFor="filter-from" className="text-xs">Dari Tanggal</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="filter-from"
                  variant={"outline"}
                  className={cn(
                    "w-full sm:w-[240px] justify-start text-left font-normal",
                    !fromDate && "text-muted-foreground"
                  )}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {fromDate ? format(new Date(fromDate + "T00:00:00"), "PPP") : <span>Pilih tanggal</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={fromDate ? new Date(fromDate + "T00:00:00") : undefined}
                  // Beri tipe 'Date | undefined' pada parameter 'date'
                  onSelect={(date: Date | undefined) => setFromDate(date ? format(date, "yyyy-MM-dd") : "")}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Filter Sampai Tanggal (Popover + Calendar) */}
          <div className="space-y-1 w-full sm:w-auto">
            <Label htmlFor="filter-to" className="text-xs">Sampai Tanggal</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="filter-to"
                  variant={"outline"}
                  className={cn(
                    "w-full sm:w-[240px] justify-start text-left font-normal",
                    !toDate && "text-muted-foreground"
                  )}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {toDate ? format(new Date(toDate + "T00:00:00"), "PPP") : <span>Pilih tanggal</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={toDate ? new Date(toDate + "T00:00:00") : undefined}
                  // Beri tipe 'Date | undefined' pada parameter 'date'
                  onSelect={(date: Date | undefined) => setToDate(date ? format(date, "yyyy-MM-dd") : "")}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Tombol Clear Filter (Tidak berubah) */}
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={clearFilters}
              title="Reset filter"
              className="h-9 w-9"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div> {/* <-- TAMBAHKAN DIV PENUTUP INI */}
        {/* --- BATAS PERBAIKAN FILTER --- */}

      </div>

      {/* ====== TABEL ====== */}
      <Card className="overflow-hidden">
        {/* ... (Isi Card Tabel tidak berubah) ... */}
         <CardHeader className="flex-row items-center justify-between py-4">
          <CardTitle className="text-lg flex items-center gap-3">
            <History className="h-5 w-5 text-primary" />
            <span>
              Riwayat Optimasi
              <Badge variant="secondary" className="ml-2">
                {rows.length} hasil
              </Badge>
            </span>
          </CardTitle>
          {q.isFetching ? (
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
              <Loader2 className="h-4 w-4 animate-spin" />
              Sinkronisasi...
            </Badge>
          ) : null}
        </CardHeader>

        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="p-8 text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat data histori...
            </div>
          ) : q.isError ? (
            <Alert variant="destructive" className="m-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Gagal Memuat Histori</AlertTitle>
              <AlertDescription>
                {(q.error as any)?.response?.data?.detail ?? (q.error as any)?.message ?? "Unknown error"}
              </AlertDescription>
            </Alert>
          ) : rows.length === 0 ? (
            <div className="p-16 text-muted-foreground text-center space-y-2">
              <Inbox className="h-12 w-12 mx-auto" />
              <p className="font-medium">Tidak Ada Data</p>
              <p className="text-sm">
                {status !== 'ALL' || fromDate || toDate
                  ? "Tidak ada data histori yang cocok dengan filter."
                  : "Belum ada histori optimasi yang tersimpan."
                }
              </p>
            </div>
          ) : (
            <div className="max-w-full overflow-x-auto">
              <Table className="min-w-[960px]">
                <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[220px]">
                      <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> Waktu</div>
                    </TableHead>
                    <TableHead className="w-[140px]">
                      <div className="flex items-center gap-2"><ListFilter className="h-4 w-4" /> Status</div>
                    </TableHead>
                    <TableHead className="w-[160px]">
                      <div className="flex items-center gap-2"><Truck className="h-4 w-4" /> Kendaraan</div>
                    </TableHead>
                    <TableHead className="w-[160px]">
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Titik Disiram</div>
                    </TableHead>
                    <TableHead className="w-[120px]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((it) => {
                    const points =
                      (it as any).points_count ??
                      (it as any).served_points ??
                      (it as any).points_total ??
                      (it as any).node_count ??
                      "—"
                    return (
                      <TableRow key={it.job_id} className="cursor-pointer" onClick={() => openDetail(it.job_id)}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {new Date(it.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={it.status} />
                        </TableCell>
                        <TableCell>{it.vehicle_count}</TableCell>
                        <TableCell>{points}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                <TableCaption className="text-xs">
                  {rows.length} item{rows.length !== 1 ? "s" : ""}
                </TableCaption>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====== DIALOG DETAIL ====== */}
      <Dialog open={open} onOpenChange={(v) => (!v ? closeDetail() : void 0)}>
        <DialogContent
          className="w-[95vw] sm:max-w-3xl lg:max-w-4xl p-0 overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header Dialog */}
          <DialogHeaderUI className="sticky top-0 z-10 bg-background/95 backdrop-blur px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitleUI className="text-lg">Detail Job Optimasi</DialogTitleUI>
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>
          </DialogHeaderUI>

          {/* Konten Dialog (Scrollable) */}
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-6 py-4"> {/* <-- Wrapper div ini penting */}
              {!selectedId ? (
                <div className="text-sm text-muted-foreground p-4">No job selected.</div>
              ) : detailQ.isLoading ? (
                <div className="text-sm text-muted-foreground p-4 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading details…
                </div>
              ) : detailQ.isError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Gagal Memuat Detail</AlertTitle>
                  <AlertDescription>
                    {(detailQ.error as any)?.response?.data?.detail ??
                      (detailQ.error as any)?.message ??
                      "Unknown error"}
                  </AlertDescription>
                </Alert>
              ) : detailQ.data ? (
                <DetailsContent detail={detailQ.data} />
              ) : null}
            </div> {/* <-- Pastikan div ini ditutup */}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </section>
  )
}

// ====== KOMPONEN DETAILS CONTENT (dengan TABS) ======
// ... (Komponen DetailsContent tidak perlu diubah) ...
function DetailsContent({ detail }: { detail: JobDetail }) {
  const vehicles = detail.vehicles ?? []
  const routes = detail.routes ?? []

  return (
    <Tabs defaultValue="summary" className="w-full">
      {/* Tab Triggers */}
      <TabsList className="grid w-full grid-cols-3 mb-4">
        <TabsTrigger value="summary">
          <Info className="mr-2 h-4 w-4" />
          Ringkasan
        </TabsTrigger>
        <TabsTrigger value="vehicles">
          <Users className="mr-2 h-4 w-4" />
          Kendaraan & Operator
        </TabsTrigger>
        <TabsTrigger value="routes">
          <ListTree className="mr-2 h-4 w-4" />
          Detail Rute
        </TabsTrigger>
      </TabsList>

      {/* --- Tab 1: Ringkasan --- */}
      <TabsContent value="summary">
        <Card>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-6 text-sm">
            <div className="flex items-start gap-3">
              <Hash className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Job ID</div>
                <div className="font-mono text-xs break-all">{detail.job_id}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Created At</div>
                <div className="font-medium">{new Date(detail.created_at).toLocaleString()}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <StatusBadge status={detail.status} />
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* --- Tab 2: Kendaraan --- */}
      <TabsContent value="vehicles" className="space-y-4">
        {vehicles.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center p-8">
            Tidak ada data kendaraan.
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daftar Kendaraan & Operator</CardTitle>
              <CardDescription>{vehicles.length} kendaraan dialokasikan.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Nopol</TableHead>
                      <TableHead>Operator</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Durasi Rute</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((v, i) => (
                      <TableRow key={`${v.vehicle_id}-${i}`}>
                        <TableCell className="font-medium">#{v.vehicle_id}</TableCell>
                        <TableCell>{(v as any).plate ?? "—"}</TableCell>
                        <TableCell>{(v as any).operator?.name ?? "—"}</TableCell>
                        <TableCell className="capitalize">
                          <StatusBadge status={((v as any).status ?? "unknown") as JobStatus} />
                        </TableCell>
                        <TableCell>
                          {typeof (v as any).route_total_time_min === "number"
                            ? `${(v as any).route_total_time_min} min (${minutesToHHMM(
                                (v as any).route_total_time_min,
                              )})`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* --- Tab 3: Rute --- */}
      <TabsContent value="routes" className="space-y-4">
        {routes.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center p-8">Rute belum tersedia.</div>
        ) : (
          <div className="space-y-4">
            {routes.map((r, idx) => (
              <Card key={`${r.vehicle_id}-${idx}`}>
                <CardHeader className="py-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Vehicle #{r.vehicle_id}
                    {typeof r.total_time_min === "number" && (
                      <span className="ml-2 text-sm text-muted-foreground font-normal">
                        ({r.total_time_min} min / {minutesToHHMM(r.total_time_min)})
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="font-mono text-xs break-all p-3 bg-muted rounded-md">
                    {(r.sequence ?? []).join(" → ")}
                  </div>

                  {/* Per-step dengan status & reason */}
                  {(() => {
                    const v = vehicles.find(
                      (v) => String((v as any).vehicle_id) === String(r.vehicle_id),
                    )
                    const steps = (v as any)?.route ?? []
                    if (!steps?.length) return null
                    return (
                      <div className="space-y-2">
                        <Label className="text-xs">Detail Langkah (Steps)</Label>
                        <div className="max-w-full overflow-x-auto rounded-md border">
                          <Table className="text-xs">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-16">Idx</TableHead>
                                <TableHead className="w-32">Node</TableHead>
                                <TableHead className="w-28">Status</TableHead>
                                <TableHead>Reason</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {steps
                                .slice()
                                .sort(
                                  (a: any, b: any) =>
                                    (a.sequence_index ?? 0) - (b.sequence_index ?? 0),
                                )
                                .map((s: any) => (
                                  <TableRow key={s.sequence_index}>
                                    <TableCell>{s.sequence_index}</TableCell>
                                    <TableCell className="font-mono">{s.node_id}</TableCell>
                                    <TableCell className="capitalize">
                                      <StatusBadge status={(s.status ?? "unknown") as JobStatus} />
                                    </TableCell>
                                    <TableCell>{s.reason ?? "—"}</TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}
