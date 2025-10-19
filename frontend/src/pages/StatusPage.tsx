// src/pages/StatusPage.tsx
import { useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { Api } from "../lib/api"
import type { HistoryItem, JobDetail, JobVehicle, JobRouteStep } from "../types"
import { useStatusUI } from "../stores/status"

// shadcn ui
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Save, ListChecks, ChevronDown } from "lucide-react"

const VEHICLE_STATUS = ["planned", "in_progress", "done", "done_with_issues", "cancelled"] as const
const STEP_STATUS = ["planned", "visited", "skipped", "failed"] as const

function SelectNative(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        "w-full h-9 rounded-md border bg-background px-3 text-sm",
        props.className || "",
      ].join(" ")}
    />
  )
}

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
    gcTime: 10 * 60_000,
  })

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
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  })

  const vehicles: JobVehicle[] = useMemo(() => jobDetail?.vehicles ?? [], [jobDetail])

  // mutations
  const updateVehicleStatus = useMutation({
    mutationFn: (p: { jobId: string; vid: string | number; status: string }) =>
      Api.assignJobVehicle(p.jobId, p.vid, { status: p.status }),
    onSuccess: () => {
      if (selectedJobId) qc.invalidateQueries({ queryKey: ["job-detail", selectedJobId] })
      toast({ title: "Vehicle status updated" })
    },
    onError: (err: any) => {
      toast({
        title: "Gagal update vehicle",
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
      toast({ title: "Step updated" })
    },
    onError: (err: any) => {
      toast({
        title: "Gagal update step",
        description: err?.response?.data?.detail ?? err?.message ?? "Unknown error",
        variant: "destructive",
      })
    },
  })

  const stepKey = (vid: string | number, seq: number | string) => `${vid}:${seq}`

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Status — Vehicles & Stops</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ListChecks className="h-4 w-4" />
          <span>
            {selectedJobId ? "Job selected" : "No job"} • {vehicles.length} vehicle
            {vehicles.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Pilih Job */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Pilih Job</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <SelectNative
            value={selectedJobId}
            onChange={(e) => {
              setSelectedJobId(e.target.value)
              clearPicks()
            }}
          >
            <option value="">— pilih job —</option>
            {jobs.map((j) => (
              <option key={j.job_id} value={j.job_id}>
                {j.status} · {new Date(j.created_at).toLocaleString()} · {j.vehicle_count} vehicles
              </option>
            ))}
          </SelectNative>

          <div className="flex items-center gap-3 text-xs">
            {loadingJobs && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading jobs…
              </span>
            )}
            {jobsErr && (
              <span className="text-destructive">
                Gagal memuat jobs: {(jobsErr as Error).message}
              </span>
            )}
            {selectedJobId && loadingDetail && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading job summary…
              </span>
            )}
            {jobErr && (
              <span className="text-destructive">
                Gagal memuat job: {(jobErr as Error).message}
              </span>
            )}
          </div>

          {selectedJobId && jobDetail && !loadingDetail && !jobErr ? (
            <div className="text-sm text-muted-foreground">
              {jobDetail.status} · {new Date(jobDetail.created_at).toLocaleString()}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Vehicles — 1 bar per vehicle + dropdown */}
      {selectedJobId && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Vehicles</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {vehicles.map((v) => {
                const vid = String(v.vehicle_id)
                const vehPick = perVeh[vid] ?? {}
                const steps: JobRouteStep[] = Array.isArray(v.route)
                  ? (v.route as JobRouteStep[])
                  : []

                return (
                  <li key={vid} className="px-3">
                    <details className="group">
                      {/* Bar */}
                      <summary className="list-none flex items-center gap-3 py-3 cursor-pointer select-none">
                        <div className="flex items-center justify-center rounded-md border w-7 h-7 text-xs">
                          #{v.vehicle_id}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">Vehicle #{v.vehicle_id}</span>
                            <Badge variant="secondary" className="capitalize">
                              {(v as any).status ?? "—"}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Route time ≈ {v.route_total_time_min ?? "—"} min
                          </div>
                        </div>
                        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                      </summary>

                      {/* Panel content */}
                      <div className="pb-4">
                        {/* Update vehicle status */}
                        <div className="rounded-md border p-3 mb-3">
                          <div className="text-xs text-muted-foreground mb-2">
                            Update Vehicle Status
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <SelectNative
                              value={vehPick.status ?? (v as any).status ?? "planned"}
                              onChange={(e) =>
                                setPerVeh((s) => ({
                                  ...s,
                                  [vid]: { ...(s[vid] ?? {}), status: e.target.value },
                                }))
                              }
                              className="sm:max-w-[220px]"
                            >
                              {VEHICLE_STATUS.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </SelectNative>
                            <Button
                              className="sm:w-auto"
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
                                  Saving…
                                </>
                              ) : (
                                <>
                                  <Save className="mr-2 h-4 w-4" />
                                  Save
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Steps compact (tanpa table, no horizontal scroll) */}
                        <div className="rounded-md border">
                          <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                            Route Steps ({steps.length})
                          </div>
                          {steps.length === 0 ? (
                            <div className="px-3 pb-3 text-sm text-muted-foreground">No steps.</div>
                          ) : (
                            <ul className="max-h-[360px] overflow-y-auto">
                              {steps
                                .slice()
                                .sort(
                                  (a: JobRouteStep, b: JobRouteStep) =>
                                    (a.sequence_index ?? 0) - (b.sequence_index ?? 0),
                                )
                                .map((s) => {
                                  const seq = s.sequence_index ?? 0
                                  const key = stepKey(vid, seq)
                                  const pickStatus = perStep[key]?.status ?? s.status ?? "planned"
                                  const pickReason = perStep[key]?.reason ?? ""

                                  return (
                                    <li key={key} className="px-3 py-2 border-t first:border-t-0">
                                      {/* Row 1 */}
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs px-2 py-0.5 rounded-md border">
                                          #{seq}
                                        </span>
                                        <span className="font-mono text-xs truncate">
                                          {String(s.node_id)}
                                        </span>
                                        <span className="text-xs capitalize text-muted-foreground">
                                          Current: {s.status ?? "-"}
                                        </span>
                                      </div>

                                      {/* Row 2: controls */}
                                      <div className="mt-2 flex flex-col sm:flex-row gap-2">
                                        <SelectNative
                                          className="sm:max-w-[160px]"
                                          value={pickStatus}
                                          onChange={(e) =>
                                            setPerStep((st) => ({
                                              ...st,
                                              [key]: { ...(st[key] ?? {}), status: e.target.value },
                                            }))
                                          }
                                        >
                                          {STEP_STATUS.map((st) => (
                                            <option key={st} value={st}>
                                              {st}
                                            </option>
                                          ))}
                                        </SelectNative>
                                        <Input
                                          placeholder="Reason (opsional)"
                                          value={pickReason}
                                          onChange={(e) =>
                                            setPerStep((st) => ({
                                              ...st,
                                              [key]: { ...(st[key] ?? {}), reason: e.target.value },
                                            }))
                                          }
                                        />
                                        <Button
                                          variant="outline"
                                          className="sm:w-auto"
                                          disabled={updateStepStatus.isPending}
                                          onClick={() =>
                                            updateStepStatus.mutate({
                                              jobId: selectedJobId!,
                                              vid,
                                              seq,
                                              status: perStep[key]?.status ?? s.status ?? "planned",
                                              reason: perStep[key]?.reason || undefined,
                                            })
                                          }
                                        >
                                          Set
                                        </Button>
                                      </div>
                                    </li>
                                  )
                                })}
                            </ul>
                          )}
                        </div>
                      </div>
                    </details>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
