// src/pages/LogsPage.tsx
import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { Api } from "../lib/api"
import type { HistoryItem, JobDetail, JobStatus } from "../types"
import StatusBadge from "../components/StatusBadge"
import { minutesToHHMM } from "../lib/format"
import { useLogsUI } from "../stores/logs"

// Date-fns
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from "date-fns"

// Framer Motion
import { motion, AnimatePresence } from "framer-motion"

// shadcn utils & UI
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DialogClose } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader as DialogHeaderUI, DialogTitle as DialogTitleUI,
} from "@/components/ui/dialog"
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"

// Icons
import {
  Loader2, Eye, History, CalendarDays, X, Inbox, AlertCircle, Truck, Hash, Info, Users, ListTree, ArrowUpDown,
} from "lucide-react"

// ===== ✨ motion variants =====
// ===== ✨ motion variants =====
const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
} as const

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
  transition: { duration: 0.22, ease: "easeOut" as const },
} as const

const stagger = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
} as const

const rowItem = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    y: 6,
    transition: { duration: 0.15, ease: "easeInOut" as const },
  },
} as const


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
  const [sortColumn, setSortColumn] = useState<keyof HistoryItem>("created_at" as keyof HistoryItem)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Sync URL -> store
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

  // Sync store -> URL
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

  // Data
  const q = useQuery<HistoryItem[]>({
    queryKey: ["jobs-history"],
    queryFn: Api.listHistory,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  // Filter & Sort
  const filteredAndSortedRows = useMemo(() => {
    const items = q.data ?? []
    const st = status === "ALL" ? null : String(status).toLowerCase()

    let filtered = items.filter((it) => {
      const okStatus = st ? String(it.status).toLowerCase() === st : true
      const d = new Date(it.created_at)
      const dateStr = ymdLocal(d)
      const afterFrom = !fromDate || dateStr >= fromDate
      const beforeTo = !toDate || dateStr <= toDate
      return okStatus && afterFrom && beforeTo
    })

    if (sortColumn) {
      filtered.sort((a, b) => {
        const valA = a[sortColumn] as any
        const valB = b[sortColumn] as any
        let comparison = 0
        if (sortColumn === "created_at") {
          comparison = new Date(valA).getTime() - new Date(valB).getTime()
        } else if (typeof valA === "string" && typeof valB === "string") {
          comparison = valA.localeCompare(valB)
        } else if (typeof valA === "number" && typeof valB === "number") {
          comparison = valA - valB
        }
        return sortDirection === "asc" ? comparison : -comparison
      })
    }
    return filtered
  }, [q.data, status, fromDate, toDate, sortColumn, sortDirection])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRows.length / itemsPerPage))
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredAndSortedRows.slice(startIndex, endIndex)
  }, [filteredAndSortedRows, currentPage, itemsPerPage])

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages))
  }

  const handleSort = (column: keyof HistoryItem) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
    setCurrentPage(1)
  }

  // Preset tanggal
  const setDatePreset = (preset: "today" | "last7days" | "thisMonth") => {
    const now = new Date()
    let start: Date | null = null
    let end: Date | null = null
    switch (preset) {
      case "today": start = startOfDay(now); end = endOfDay(now); break
      case "last7days": start = startOfDay(subDays(now, 6)); end = endOfDay(now); break
      case "thisMonth": start = startOfMonth(now); end = endOfMonth(now); break
    }
    setFromDate(start ? format(start, "yyyy-MM-dd") : "")
    setToDate(end ? format(end, "yyyy-MM-dd") : "")
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setStatus("ALL")
    setFromDate("")
    setToDate("")
    setCurrentPage(1)
  }

  // Detail via URL ?detail=<jobId>
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
    // ✨ page wrapper
    <motion.section className="space-y-6 p-1" {...fadeIn}>
      {/* ====== HEADER & FILTER ====== */}
      <motion.div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4" {...fadeUp}>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Histori Optimasi</h1>
          <p className="text-muted-foreground">Lihat riwayat dari semua proses optimasi yang telah dijalankan.</p>
        </div>

        {/* Filter Area */}
        <motion.div className="w-full md:w-auto md:ml-auto space-y-3" {...fadeIn}>
          {/* Baris atas: Status, Dari, Sampai */}
          <div className="flex flex-wrap gap-3 justify-start md:justify-end">
            {/* Status */}
            <div className="flex flex-col space-y-1 w-full sm:w-[180px] md:w-[180px]">
              <Label htmlFor="filter-status" className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => { setStatus(v as any); setCurrentPage(1) }}>
                <SelectTrigger id="filter-status"><SelectValue placeholder="Filter status..." /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dari Tanggal */}
            <div className="flex flex-col space-y-1 w-full sm:w-[200px] md:w-[200px]">
              <Label htmlFor="filter-from" className="text-xs">Dari Tanggal</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="filter-from"
                    variant="outline"
                    className={cn("justify-start text-left font-normal", !fromDate && "text-muted-foreground")}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {fromDate ? format(new Date(fromDate + "T00:00:00"), "PPP") : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={fromDate ? new Date(fromDate + "T00:00:00") : undefined}
                    onSelect={(date: Date | undefined) => { setFromDate(date ? format(date, "yyyy-MM-dd") : ""); setCurrentPage(1) }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Sampai Tanggal */}
            <div className="flex flex-col space-y-1 w-full sm:w-[200px] md:w-[200px]">
              <Label htmlFor="filter-to" className="text-xs">Sampai Tanggal</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="filter-to"
                    variant="outline"
                    className={cn("justify-start text-left font-normal", !toDate && "text-muted-foreground")}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {toDate ? format(new Date(toDate + "T00:00:00"), "PPP") : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={toDate ? new Date(toDate + "T00:00:00") : undefined}
                    onSelect={(date: Date | undefined) => { setToDate(date ? format(date, "yyyy-MM-dd") : ""); setCurrentPage(1) }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Baris bawah: Preset (align kanan) */}
          <div className="flex justify-end items-center gap-1">
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button variant="outline" size="sm" onClick={() => setDatePreset("today")}>Hari Ini</Button>
            </motion.div>
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button variant="outline" size="sm" onClick={() => setDatePreset("last7days")}>7 Hari</Button>
            </motion.div>
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button variant="outline" size="sm" onClick={() => setDatePreset("thisMonth")}>Bulan Ini</Button>
            </motion.div>
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button variant="ghost" size="icon" onClick={clearFilters} title="Reset filter" className="h-9 w-9">
                <X className="h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>

      {/* ====== TABEL ====== */}
      <motion.div {...fadeUp}>
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between py-4">
            <CardTitle className="text-lg flex items-center gap-3">
              <History className="h-5 w-5 text-primary" />
              <span>
                Riwayat Optimasi
                <Badge variant="secondary" className="ml-2">{filteredAndSortedRows.length} hasil</Badge>
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
            ) : filteredAndSortedRows.length === 0 ? (
              <motion.div className="p-16 text-muted-foreground text-center space-y-2" {...fadeIn}>
                <Inbox className="h-12 w-12 mx-auto" />
                <p className="font-medium">Tidak Ada Data</p>
                <p className="text-sm">
                  {status !== "ALL" || fromDate || toDate
                    ? "Tidak ada data histori yang cocok dengan filter."
                    : "Belum ada histori optimasi yang tersimpan."}
                </p>
              </motion.div>
            ) : (
              <>
                <div className="max-w-full overflow-x-auto">
                  <Table className="min-w-[960px]">
                    <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40">
                      <TableRow>
                        {/* Kolom Waktu */}
                        <TableHead className="w-[220px]">
                          <Button variant="ghost" size="sm" onClick={() => handleSort("created_at")} className="-ml-3">
                            Waktu{" "}
                            <ArrowUpDown className={cn("ml-2 h-3 w-3", sortColumn === "created_at" ? "opacity-100" : "opacity-50")} />
                          </Button>
                        </TableHead>
                        {/* Status */}
                        <TableHead className="w-[140px]">
                          <Button variant="ghost" size="sm" onClick={() => handleSort("status")} className="-ml-3">
                            Status{" "}
                            <ArrowUpDown className={cn("ml-2 h-3 w-3", sortColumn === "status" ? "opacity-100" : "opacity-50")} />
                          </Button>
                        </TableHead>
                        {/* Kendaraan */}
                        <TableHead className="w-[160px]">
                          <Button variant="ghost" size="sm" onClick={() => handleSort("vehicle_count")} className="-ml-3">
                            Kendaraan{" "}
                            <ArrowUpDown className={cn("ml-2 h-3 w-3", sortColumn === "vehicle_count" ? "opacity-100" : "opacity-50")} />
                          </Button>
                        </TableHead>
                        <TableHead className="w-[160px]">Titik Disiram</TableHead>
                        <TableHead className="w-[120px]">Details</TableHead>
                      </TableRow>
                    </TableHeader>

                    {/* ✨ stagger rows */}
                    <TableBody>
  {paginatedRows.map((it, idx) => {
    const points =
      (it as any).points_count ??
      (it as any).served_points ??
      (it as any).points_total ??
      (it as any).node_count ??
      "—"

    const delay = idx * 0.03 // stagger ringan

    return (
      <TableRow
        key={it.job_id}
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => openDetail(it.job_id)}
      >
        <TableCell className="whitespace-nowrap font-medium">
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay }}
          >
            {new Date(it.created_at).toLocaleString()}
          </motion.div>
        </TableCell>

        <TableCell>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18, delay: delay + 0.01 }}>
            <StatusBadge status={it.status} />
          </motion.div>
        </TableCell>

        <TableCell>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18, delay: delay + 0.02 }}>
            {it.vehicle_count}
          </motion.div>
        </TableCell>

        <TableCell>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18, delay: delay + 0.03 }}>
            {points}
          </motion.div>
        </TableCell>

        <TableCell>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18, delay: delay + 0.04 }}>
            <Button variant="ghost" size="sm">
              <Eye className="mr-2 h-4 w-4" />
              View
            </Button>
          </motion.div>
        </TableCell>
      </TableRow>
    )
  })}
</TableBody>


                    <TableCaption className="text-xs">
                      Menampilkan {paginatedRows.length} dari {filteredAndSortedRows.length} hasil. Halaman {currentPage} dari {totalPages}.
                    </TableCaption>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center py-4 border-t">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            aria-disabled={currentPage === 1}
                            className={cn(currentPage === 1 && "pointer-events-none opacity-50")}
                            onClick={(e) => { e.preventDefault(); handlePageChange(currentPage - 1) }}
                          />
                        </PaginationItem>

                        {[...Array(totalPages)].map((_, i) => (
                          <PaginationItem key={i}>
                            <motion.div whileTap={{ scale: 0.98 }}>
                              <PaginationLink
                                href="#"
                                isActive={currentPage === i + 1}
                                onClick={(e) => { e.preventDefault(); handlePageChange(i + 1) }}
                              >
                                {i + 1}
                              </PaginationLink>
                            </motion.div>
                          </PaginationItem>
                        ))}

                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            aria-disabled={currentPage === totalPages}
                            className={cn(currentPage === totalPages && "pointer-events-none opacity-50")}
                            onClick={(e) => { e.preventDefault(); handlePageChange(currentPage + 1) }}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ====== DIALOG DETAIL ====== */}
      <Dialog open={open} onOpenChange={(v) => (!v ? closeDetail() : void 0)}>
        <DialogContent className="w-[95vw] sm:max-w-3xl lg:max-w-4xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
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

          {/* ✨ dialog content fade */}
          <ScrollArea className="flex-1 overflow-y-auto">
            <motion.div className="px-6 py-4" {...fadeIn}>
              {!selectedId ? (
                <div className="text-sm text-muted-foreground p-4">No job selected.</div>
              ) : detailQ.isLoading ? (
                <DetailDialogSkeleton />
              ) : detailQ.isError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Gagal Memuat Detail</AlertTitle>
                  <AlertDescription>
                    {(detailQ.error as any)?.response?.data?.detail ??
                      (detailQ.error as any)?.message ?? "Unknown error"}
                  </AlertDescription>
                </Alert>
              ) : detailQ.data ? (
                <DetailsContent detail={detailQ.data} />
              ) : null}
            </motion.div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </motion.section>
  )
}

// ====== KOMPONEN DETAILS CONTENT (dengan TABS) ======
function DetailsContent({ detail }: { detail: JobDetail }) {
  const vehicles = detail.vehicles ?? []
  const routes = detail.routes ?? []

  return (
    <Tabs defaultValue="summary" className="w-full">
      {/* Tab Triggers */}
      <TabsList className="grid w-full grid-cols-3 mb-4">
        <TabsTrigger value="summary"><Info className="mr-2 h-4 w-4" />Ringkasan</TabsTrigger>
        <TabsTrigger value="vehicles"><Users className="mr-2 h-4 w-4" />Kendaraan & Operator</TabsTrigger>
        <TabsTrigger value="routes"><ListTree className="mr-2 h-4 w-4" />Detail Rute</TabsTrigger>
      </TabsList>

      {/* --- Tab 1: Ringkasan --- */}
      <TabsContent value="summary">
        <motion.div {...fadeUp}>
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
        </motion.div>
      </TabsContent>

      {/* --- Tab 2: Kendaraan --- */}
      <TabsContent value="vehicles" className="space-y-4">
        <AnimatePresence mode="wait">
          {vehicles.length === 0 ? (
            <motion.div {...fadeIn} className="text-sm text-muted-foreground text-center p-8">
              Tidak ada data kendaraan.
            </motion.div>
          ) : (
            <motion.div {...fadeUp}>
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
  {vehicles.map((v, i) => {
    const delay = i * 0.03
    return (
      <TableRow key={`${v.vehicle_id}-${i}`}>
        <TableCell className="font-medium">
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay }}>
            #{v.vehicle_id}
          </motion.div>
        </TableCell>
        <TableCell>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18, delay: delay + 0.01 }}>
            {(v as any).plate ?? "—"}
          </motion.div>
        </TableCell>
        <TableCell>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18, delay: delay + 0.02 }}>
            {(v as any).operator?.name ?? "—"}
          </motion.div>
        </TableCell>
        <TableCell className="capitalize">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18, delay: delay + 0.03 }}>
            <StatusBadge status={((v as any).status ?? "unknown") as JobStatus} />
          </motion.div>
        </TableCell>
        <TableCell>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18, delay: delay + 0.04 }}>
            {typeof (v as any).route_total_time_min === "number"
              ? `${(v as any).route_total_time_min} min (${minutesToHHMM((v as any).route_total_time_min)})`
              : "—"}
          </motion.div>
        </TableCell>
      </TableRow>
    )
  })}
</TableBody>

                    </Table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </TabsContent>

      {/* --- Tab 3: Rute --- */}
      <TabsContent value="routes" className="space-y-4">
        <AnimatePresence mode="wait">
          {routes.length === 0 ? (
            <motion.div {...fadeIn} className="text-sm text-muted-foreground text-center p-8">Rute belum tersedia.</motion.div>
          ) : (
            <motion.div className="space-y-4" variants={stagger} initial="initial" animate="animate">
              {routes.map((r, idx) => (
                <motion.div key={`${r.vehicle_id}-${idx}`} variants={rowItem}>
                  <Card>
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
    .sort((a: any, b: any) => (a.sequence_index ?? 0) - (b.sequence_index ?? 0))
    .map((s: any, idx: number) => {
      const delay = idx * 0.02
      return (
        <TableRow key={s.sequence_index}>
          <TableCell>
            <motion.div initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16, delay }}>
              {s.sequence_index}
            </motion.div>
          </TableCell>
          <TableCell className="font-mono">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16, delay: delay + 0.01 }}>
              {s.node_id}
            </motion.div>
          </TableCell>
          <TableCell className="capitalize">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16, delay: delay + 0.02 }}>
              <StatusBadge status={(s.status ?? "unknown") as JobStatus} />
            </motion.div>
          </TableCell>
          <TableCell>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16, delay: delay + 0.03 }}>
              {s.reason ?? "—"}
            </motion.div>
          </TableCell>
        </TableRow>
      )
    })}
</TableBody>

                              </Table>
                            </div>
                          </div>
                        )
                      })()}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </TabsContent>
    </Tabs>
  )
}

// ====== KOMPONEN SKELETON UNTUK DIALOG DETAIL ======
function DetailDialogSkeleton() {
  return (
    <div className="space-y-4">
      {/* Skeleton Tabs List */}
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-10 w-1/3 rounded-md" />
        <Skeleton className="h-10 w-1/3 rounded-md" />
        <Skeleton className="h-10 w-1/3 rounded-md" />
      </div>
      {/* Skeleton Card Ringkasan */}
      <Card>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-6">
          <div className="flex items-start gap-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
