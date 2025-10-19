// src/pages/LogsPage.tsx
import { useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { Api } from "../lib/api"
import type { HistoryItem, JobDetail, JobStatus } from "../types"
import StatusBadge from "../components/StatusBadge"
import { minutesToHHMM } from "../lib/format"
import { useLogsUI } from "../stores/logs"

// shadcn ui
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { useToast } from "@/hooks/use-toast"
import { Loader2, Filter, Eye } from "lucide-react"

// helper: YYYY-MM-DD lokal
function ymdLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const da = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${da}`
}

export default function LogsPage() {
  const { status, setStatus, fromDate, setFromDate, toDate, setToDate } = useLogsUI()
  const [sp, setSp] = useSearchParams()
  const { toast } = useToast()

  // ===== Sinkronisasi Filter <-> URL =====
  useEffect(() => {
    const s = (sp.get("status") ?? "").toLowerCase()
    const f = sp.get("from") ?? ""
    const t = sp.get("to") ?? ""

    const allowed: Array<"ALL" | JobStatus> = [
      "ALL",
      "planned",
      "running",
      "succeeded",
      "failed",
      "cancelled",
    ]
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
    staleTime: 60_000,
    gcTime: 10 * 60_000,
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

  // ===== Detail via URL ?detail=<jobId> =====
  const selectedId = sp.get("detail")
  const open = !!selectedId

  const detailQ = useQuery<JobDetail>({
    queryKey: ["job-detail", selectedId],
    queryFn: () => Api.getJobDetail(selectedId as string),
    enabled: !!selectedId,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
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

  // notif error global ringan (opsional)
  useEffect(() => {
    if (q.isError) {
      toast({
        title: "Gagal memuat history",
        description:
          (q.error as any)?.response?.data?.detail ??
          (q.error as any)?.message ??
          "Unknown error",
        variant: "destructive",
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.isError])

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">History</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>
            {status === "ALL" ? "All" : status} • {rows.length} item
            {rows.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs mb-1 text-muted-foreground">Status</label>
            {/* pakai native select (belum install shadcn Select) */}
            <select
              className="w-full h-9 rounded-md border bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="ALL">All</option>
              <option value="planned">planned</option>
              <option value="running">running</option>
              <option value="succeeded">succeeded</option>
              <option value="failed">failed</option>
              <option value="cancelled">cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-xs mb-1 text-muted-foreground">From</label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs mb-1 text-muted-foreground">To</label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Tabel */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b">
          <span className="text-sm font-medium">Riwayat Optimasi</span>
          {q.isFetching ? (
            <Badge variant="secondary" className="gap-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </Badge>
          ) : null}
        </div>

        {q.isError ? (
          <div className="p-4 text-sm text-destructive">
            Gagal memuat history:{" "}
            {(q.error as any)?.response?.data?.detail ??
              (q.error as any)?.message ??
              "Unknown error"}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-sm text-muted-foreground text-center">Belum ada history.</div>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <Table className="min-w-[960px]">
              <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40">
                <TableRow>
                  <TableHead className="w-[220px]">Time</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="w-[160px]">Kendaraan</TableHead>
                  <TableHead className="w-[160px]">Titik Disiram</TableHead>
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
                    <TableRow key={it.job_id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(it.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={it.status} />
                      </TableCell>
                      <TableCell>{it.vehicle_count}</TableCell>
                      <TableCell>{points}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openDetail(it.job_id)}>
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
      </Card>

      {/* Dialog Detail */}
      <Dialog open={open} onOpenChange={(v) => (!v ? closeDetail() : void 0)}>
  <DialogContent
    // batasi lebar & tinggi, dan pastikan konten bisa scroll
    className="w-[95vw] sm:max-w-3xl lg:max-w-4xl p-0 overflow-hidden max-h-[85vh]"
  >
    {/* Header sticky */}
    <DialogHeaderUI className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 py-3 border-b">
      <div className="flex items-center justify-between">
        <DialogTitleUI>Job Details</DialogTitleUI>
        <button
          type="button"
          className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent"
          onClick={closeDetail}
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </DialogHeaderUI>

    {/* Konten scroll area */}
    <div className="overflow-y-auto max-h-[calc(85vh-52px)] px-4 py-4">
      {!selectedId ? (
        <div className="text-sm text-muted-foreground">No job selected.</div>
      ) : detailQ.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading details…</div>
      ) : detailQ.isError ? (
        <div className="text-sm text-destructive">
          Gagal memuat detail:{" "}
          {(detailQ.error as any)?.response?.data?.detail ??
            (detailQ.error as any)?.message ??
            "Unknown error"}
        </div>
      ) : detailQ.data ? (
        <div className="pr-2"> {/* ruang kecil untuk scrollbar supaya header/tombol gak ketutup */}
          <DetailsContent detail={detailQ.data} />
        </div>
      ) : null}
    </div>
  </DialogContent>
</Dialog>

    </section>
  )
}

function DetailsContent({ detail }: { detail: JobDetail }) {
  const vehicles = detail.vehicles ?? []
  const routes = detail.routes ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Job ID</div>
            <div className="font-mono text-xs break-all">{detail.job_id}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Created At</div>
            <div>{new Date(detail.created_at).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Status</div>
            <div className="capitalize">{detail.status}</div>
          </div>
        </CardContent>
      </Card>

      {/* Kendaraan & Operator */}
      <div className="space-y-2">
        <div className="font-medium">Kendaraan & Operator</div>
        {vehicles.length === 0 ? (
          <div className="text-sm text-muted-foreground">Tidak ada data kendaraan.</div>
        ) : (
          <div className="max-w-full overflow-x-auto -mx-1">
            <Table className="min-w-[760px]">
              <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40">
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
                    <TableCell>#{v.vehicle_id}</TableCell>
                    <TableCell>{(v as any).plate ?? "—"}</TableCell>
                    <TableCell>{(v as any).operator?.name ?? "—"}</TableCell>
                    <TableCell className="capitalize">{(v as any).status ?? "—"}</TableCell>
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
        )}
      </div>

      {/* Rute */}
      <div className="space-y-2">
        <div className="font-medium">Rute</div>
        {routes.length === 0 ? (
          <div className="text-sm text-muted-foreground">Rute belum tersedia.</div>
        ) : (
          <div className="space-y-3">
            {routes.map((r, idx) => (
              <Card key={`${r.vehicle_id}-${idx}`}>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">
                    Vehicle #{r.vehicle_id}
                    {typeof r.total_time_min === "number" && (
                      <span className="ml-2 text-xs text-muted-foreground font-normal">
                        {r.total_time_min} min ({minutesToHHMM(r.total_time_min)})
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="font-mono text-xs break-all">
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
                      <div className="max-w-full overflow-x-auto -mx-1">
                        <Table className="min-w-[560px] text-xs">
                          <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40">
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
                                  <TableCell>{s.node_id}</TableCell>
                                  <TableCell className="capitalize">
                                    {s.status ?? "—"}
                                  </TableCell>
                                  <TableCell>{s.reason ?? "—"}</TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
