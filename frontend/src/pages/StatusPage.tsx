// src/pages/StatusPage.tsx
import { useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom";
import { Api } from "../lib/api"
import type { HistoryItem, JobDetail, JobVehicle, JobRouteStep, JobStatus } from "../types"
import { useStatusUI } from "../stores/status"
import StatusBadge from "../components/StatusBadge" // Kita pakai StatusBadge

// --- SHADCN UI (YANG BARU DITAMBAH) ---
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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

// --- (YANG LAMA) ---
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

// --- ICONS ---
import {
  Loader2,
  Save,
  ListChecks,
  AlertCircle, // baru
  ClipboardList, // baru
  Truck, // baru
  Route, // baru
  CheckSquare, // baru
  Inbox, // baru
  Settings2, // baru
} from "lucide-react"

// HAPUS FUNGSI SelectNative (sudah tidak dipakai)

const VEHICLE_STATUS: JobStatus[] = ["planned", "in_progress", "done", "done_with_issues", "cancelled"]
const STEP_STATUS: JobStatus[] = ["planned", "visited", "skipped", "failed"]

export default function StatusPage() {
  const qc = useQueryClient()
  const [sp, setSp] = useSearchParams()
  const { toast } = useToast()

  const { selectedJobId, setSelectedJobId, perVeh, setPerVeh, perStep, setPerStep, clearPicks } =
    useStatusUI()

  // jobs
  const {
    data: jobs = [],
    isLoading: loadingJobs,
    error: jobsErr,
  } = useQuery<HistoryItem[]>({
    queryKey: ["jobs-history"],
    queryFn: Api.listHistory,
    staleTime: 60_000,
    refetchInterval: 30_000, // Refresh
  })

  // Filter jobs yang masih relevan untuk di-update (optional, tapi bagus)
  const activeJobs = useMemo(() => {
    return jobs.filter(j => !["succeeded", "failed", "cancelled"].includes(j.status))
  }, [jobs])


  useEffect(() => {
    const q = sp.get("jobId") ?? ""
    if (q && q !== selectedJobId) setSelectedJobId(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const next = new URLSearchParams(sp)
    if (selectedJobId) next.set("jobId", selectedJobId)
    else next.delete("jobId")
    setSp(next, { replace: true })
  }, [selectedJobId, sp, setSp])

  // job detail
  const {
    data: jobDetail,
    isFetching: loadingDetail,
    error: jobErr,
  } = useQuery<JobDetail>({
    queryKey: ["job-detail", selectedJobId],
    queryFn: () => Api.getJobDetail(selectedJobId),
    enabled: !!selectedJobId,
    staleTime: 15_000, // Lebih singkat agar data fresh
    refetchInterval: 30_000,
  })

  const vehicles: JobVehicle[] = useMemo(() => jobDetail?.vehicles ?? [], [jobDetail])

  // mutations
  const updateVehicleStatus = useMutation({
    mutationFn: (p: { jobId: string; vid: string | number; status: string }) =>
      Api.assignJobVehicle(p.jobId, p.vid, { status: p.status }),
    onSuccess: () => {
      if (selectedJobId) qc.invalidateQueries({ queryKey: ["job-detail", selectedJobId] })
      toast({ title: "Status Kendaraan Diperbarui" })
    },
    onError: (err: any) => {
      toast({
        title: "Gagal update kendaraan",
        description: err?.response?.data?.detail ?? err?.message ?? "Unknown error",
        variant: "destructive",
      })
    },
  })

  const updateStepStatus = useMutation({
    mutationFn: (p: {
      jobId: string
      vid: string | number
      seq: number | string
      status: string
      reason?: string
    }) =>
      Api.updateJobVehicleStepStatus(p.jobId, p.vid, p.seq, {
        status: p.status,
        ...(p.reason ? { reason: p.reason } : {}),
      }),
    onSuccess: () => {
      if (selectedJobId) qc.invalidateQueries({ queryKey: ["job-detail", selectedJobId] })
      toast({ title: "Status Langkah Diperbarui" })
    },
    onError: (err: any) => {
      toast({
        title: "Gagal update langkah",
        description: err?.response?.data?.detail ?? err?.message ?? "Unknown error",
        variant: "destructive",
      })
    },
  })

  const stepKey = (vid: string | number, seq: number | string) => `${vid}:${seq}`

  return (
    <section className="space-y-6 p-1">
      {/* ====== HEADER HALAMAN ====== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Update Status Lapangan</h1>
          <p className="text-muted-foreground">
            Pilih job untuk memantau dan memperbarui status kendaraan serta progres rute.
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
          <Truck className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Kendaraan:</span>
          <Badge variant="default" className="text-base px-3 py-1">
            {loadingDetail ? "..." : vehicles.length}
          </Badge>
        </div>
      </div>

      {/* ====== PILIH JOB ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-primary" />
            Pilih Job Aktif
          </CardTitle>
          <CardDescription>
            Pilih job yang sedang berjalan atau terencana untuk di-update.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* UPGRADE ke shadcn Select */}
          <Select
            value={selectedJobId}
            onValueChange={(val) => {
              setSelectedJobId(val)
              clearPicks()
            }}
            disabled={loadingJobs}
          >
            <SelectTrigger className="w-full text-left">
              <SelectValue placeholder="— Pilih job yang akan di-update —" />
            </SelectTrigger>
            <SelectContent>
              {loadingJobs && (
                <div className="flex items-center justify-center p-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memuat jobs...
                </div>
              )}
              {activeJobs.length === 0 && !loadingJobs && (
                <div className="p-2 text-sm text-muted-foreground text-center">
                  Tidak ada job aktif.
                </div>
              )}
              {/* Kita format SelectItem agar lebih rapi */}
              {activeJobs.map((j) => (
                <SelectItem key={j.job_id} value={j.job_id}>
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">
                      {new Date(j.created_at).toLocaleString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={j.status} />
                      <Badge variant="outline">{j.vehicle_count} kendaraan</Badge>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Loading/Error States */}
          {jobsErr && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Gagal Memuat Daftar Job</AlertTitle>
              <AlertDescription>{(jobsErr as Error).message}</AlertDescription>
            </Alert>
          )}
          {selectedJobId && loadingDetail && (
            <Alert className="bg-muted/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Memuat Detail Job...</AlertTitle>
              <AlertDescription>
                Sedang mengambil data kendaraan dan rute untuk Job ID: {selectedJobId}
              </AlertDescription>
            </Alert>
          )}
          {jobErr && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Gagal Memuat Detail Job</AlertTitle>
              <AlertDescription>{(jobErr as Error).message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ====== DAFTAR KENDARAAN (ACCORDION) ====== */}
      {selectedJobId && !loadingDetail && !jobErr && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Update Status Kendaraan</CardTitle>
            <CardDescription>
              Klik pada kendaraan untuk melihat dan mengubah status rutenya.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {vehicles.length === 0 ? (
              <div className="p-16 text-muted-foreground text-center space-y-2">
                <Inbox className="h-12 w-12 mx-auto" />
                <p className="font-medium">Tidak Ada Kendaraan</p>
                <p className="text-sm">Job ini tidak memiliki alokasi kendaraan.</p>
              </div>
            ) : (
              // UPGRADE ke shadcn Accordion
              <Accordion type="multiple" className="w-full">
                {vehicles.map((v) => {
                  const vid = String(v.vehicle_id)
                  const vehPick = perVeh[vid] ?? {}
                  const steps: JobRouteStep[] = Array.isArray(v.route)
                    ? (v.route as JobRouteStep[]).sort(
                        (a, b) => (a.sequence_index ?? 0) - (b.sequence_index ?? 0)
                      )
                    : []

                  return (
                    <AccordionItem value={vid} key={vid}>
                      {/* Trigger (Header Accordion) */}
                      <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <Truck className="h-5 w-5 text-primary" />
                          <div className="flex-1 text-left">
                            <span className="font-bold text-base">Vehicle #{v.vehicle_id}</span>
                            <div className="text-xs text-muted-foreground">
                              Estimasi Waktu Rute: {v.route_total_time_min ?? "—"} min
                            </div>
                          </div>
                        </div>
                        <StatusBadge status={(v as any).status ?? "planned"} />
                      </AccordionTrigger>

                      {/* Content (Isi Accordion) */}
                      <AccordionContent className="px-6 py-4 border-t bg-muted/30">
                        {/* PISAHKAH DENGAN TABS! */}
                        <Tabs defaultValue="steps" className="w-full">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="steps">
                              <Route className="mr-2 h-4 w-4" />
                              Langkah Rute ({steps.length})
                            </TabsTrigger>
                            <TabsTrigger value="vehicle-status">
                              <Settings2 className="mr-2 h-4 w-4" />
                              Status Kendaraan
                            </TabsTrigger>
                          </TabsList>

                          {/* --- Tab 1: Langkah Rute --- */}
                          <TabsContent value="steps" className="pt-4">
                            <div className="rounded-md border">
                              <ScrollArea className="h-96">
                                <div className="p-1">
                                  {steps.length === 0 ? (
                                    <div className="p-4 text-sm text-muted-foreground text-center">
                                      Tidak ada langkah (steps) untuk rute ini.
                                    </div>
                                  ) : (
                                    steps.map((s) => {
                                      const seq = s.sequence_index ?? 0
                                      const key = stepKey(vid, seq)
                                      const pickStatus = perStep[key]?.status ?? s.status ?? "planned"
                                      const pickReason = perStep[key]?.reason ?? (s.reason || "")

                                      return (
                                        <div key={key} className="p-3 border-b last:border-b-0 space-y-3">
                                          {/* Info Step */}
                                          <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="text-base font-bold">
                                              #{seq}
                                            </Badge>
                                            <div className="flex-1">
                                              <div className="font-mono text-sm font-medium">{String(s.node_id)}</div>
                                              <div className="text-xs">
                                                Status Saat Ini: <StatusBadge status={s.status} />
                                              </div>
                                            </div>
                                          </div>
                                          {/* Form Update Step */}
                                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                                            <div className="space-y-1">
                                              <Label htmlFor={`s-status-${key}`} className="text-xs">Ubah Status</Label>
                                              <Select
                                                value={pickStatus}
                                                onValueChange={(val) =>
                                                  setPerStep((st) => ({
                                                    ...st,
                                                    [key]: { ...(st[key] ?? {}), status: val },
                                                  }))
                                                }
                                              >
                                                <SelectTrigger id={`s-status-${key}`}>
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {STEP_STATUS.map((st) => (
                                                    <SelectItem key={st} value={st} className="capitalize">{st}</SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                            <div className="space-y-1">
                                              <Label htmlFor={`s-reason-${key}`} className="text-xs">Alasan (Opsional)</Label>
                                              <Input
                                                id={`s-reason-${key}`}
                                                placeholder="Contoh: Taman tutup"
                                                value={pickReason}
                                                onChange={(e) =>
                                                  setPerStep((st) => ({
                                                    ...st,
                                                    [key]: { ...(st[key] ?? {}), reason: e.target.value },
                                                  }))
                                                }
                                              />
                                            </div>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              disabled={updateStepStatus.isPending}
                                              onClick={() =>
                                                updateStepStatus.mutate({
                                                  jobId: selectedJobId!,
                                                  vid,
                                                  seq,
                                                  status: pickStatus,
                                                  reason: pickReason || undefined,
                                                })
                                              }
                                            >
                                              {updateStepStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set"}
                                            </Button>
                                          </div>
                                        </div>
                                      )
                                    })
                                  )}
                                </div>
                              </ScrollArea>
                            </div>
                          </TabsContent>

                          {/* --- Tab 2: Status Kendaraan --- */}
                          <TabsContent value="vehicle-status" className="pt-4">
                            <Card className="bg-background">
                              <CardContent className="p-4 space-y-4">
                                <p className="text-sm text-muted-foreground">
                                  Ubah status keseluruhan untuk Kendaraan #{vid}.
                                </p>
                                <div className="space-y-1">
                                  <Label htmlFor={`v-status-${vid}`}>Status Kendaraan</Label>
                                  <Select
                                    value={vehPick.status ?? (v as any).status ?? "planned"}
                                    onValueChange={(val) =>
                                      setPerVeh((s) => ({
                                        ...s,
                                        [vid]: { ...(s[vid] ?? {}), status: val },
                                      }))
                                    }
                                  >
                                    <SelectTrigger id={`v-status-${vid}`} className="w-full sm:w-[240px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {VEHICLE_STATUS.map((st) => (
                                        <SelectItem key={st} value={st} className="capitalize">{st}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Button
                                  disabled={!perVeh[vid]?.status || updateVehicleStatus.isPending}
                                  onClick={() =>
                                    updateVehicleStatus.mutate({
                                      jobId: selectedJobId!,
                                      vid,
                                      status: perVeh[vid]?.status ?? (v as any).status ?? "planned",
                                    })
                                  }
                                >
                                  {updateVehicleStatus.isPending ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Menyimpan...
                                    </>
                                  ) : (
                                    <>
                                      <Save className="mr-2 h-4 w-4" />
                                      Simpan Status Kendaraan
                                    </>
                                  )}
                                </Button>
                              </CardContent>
                            </Card>
                          </TabsContent>
                        </Tabs>
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  )
}
