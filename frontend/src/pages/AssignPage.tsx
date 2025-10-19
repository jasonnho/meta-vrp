// src/pages/AssignPage.tsx
import { useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { Api } from "../lib/api"
import type { Operator, Vehicle, HistoryItem, JobDetail, JobVehicle } from "../types"
import { useAssignUI } from "../stores/assign"

// shadcn ui
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Users, Truck, Save, RotateCcw } from "lucide-react"

type PerRVSelection = Record<
  string,
  { operatorId?: string; vehicleId?: string; status?: string }
>

const STATUS_OPTIONS = ["planned", "running", "completed", "cancelled"] as const

// helper select styled native
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

export default function AssignPage() {
  const qc = useQueryClient()
  const [sp, setSp] = useSearchParams()
  const { toast } = useToast()

  // ======= Store (persist) =======
  const {
    selectedJobId,
    setSelectedJobId,
    perRV,
    setPerRV,
    clearPerRV,
    showAddOp,
    setShowAddOp,
    newOp,
    setNewOp,
    showAddVeh,
    setShowAddVeh,
    newVeh,
    setNewVeh,
  } = useAssignUI()

  // ================== 1) Jobs dropdown ==================
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

  // Sinkronisasi selectedJobId <-> URL (?jobId=...) dan toggle add forms (?add=op|veh)
  useEffect(() => {
    const j = sp.get("jobId") ?? ""
    const add = sp.get("add") ?? ""
    if (j && j !== selectedJobId) setSelectedJobId(j)
    if (add === "op") setShowAddOp(true)
    if (add === "veh") setShowAddVeh(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const next = new URLSearchParams(sp)
    if (selectedJobId) next.set("jobId", selectedJobId)
    else next.delete("jobId")

    if (showAddOp) next.set("add", "op")
    else if (showAddVeh) next.set("add", "veh")
    else next.delete("add")

    setSp(next, { replace: true })
  }, [selectedJobId, showAddOp, showAddVeh, sp, setSp])

  // ================== 2) Job detail (vehicles) ==================
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

  // Kalau ganti job → reset pilihan perRV
  useEffect(() => {
    clearPerRV()
  }, [selectedJobId, clearPerRV])

  // ================== 3) Catalogs ==================
  const { data: operators = [] } = useQuery<Operator[]>({
    queryKey: ["operators"],
    queryFn: Api.listOperators,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  })
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["vehicles"],
    queryFn: Api.listVehicles,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  })

  // ================== 4) Mutations ==================
  const assignMut = useMutation({
    mutationFn: (p: {
      jobId: string
      vid: string | number
      assigned_vehicle_id?: string
      assigned_operator_id?: string
      status?: string
    }) =>
      Api.assignJobVehicle(p.jobId, p.vid, {
        assigned_vehicle_id: p.assigned_vehicle_id,
        assigned_operator_id: p.assigned_operator_id,
        status: p.status,
      }),
    onSuccess: () => {
      if (selectedJobId) qc.invalidateQueries({ queryKey: ["job-detail", selectedJobId] })
      toast({ title: "Tugas kendaraan diperbarui" })
    },
    onError: (err: any) => {
      toast({
        title: "Gagal assign",
        description: err?.response?.data?.detail ?? err?.message ?? "Unknown error",
        variant: "destructive",
      })
    },
  })

  const updateOp = useMutation({
    mutationFn: (p: { id: string; patch: Partial<Pick<Operator, "name" | "phone" | "active">> }) =>
      Api.updateOperator(p.id, p.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operators"] }),
  })
  const deleteOp = useMutation({
    mutationFn: Api.deleteOperator,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operators"] }),
  })
  const createOp = useMutation({
    mutationFn: (p: { name: string; phone?: string; active?: boolean }) =>
      Api.createOperator({
        name: p.name,
        phone: p.phone,
        active: p.active ?? true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operators"] })
      setShowAddOp(false)
      setNewOp(() => ({ name: "", phone: "", active: true }))
      toast({ title: "Operator ditambahkan" })
    },
    onError: (err: any) =>
      toast({
        title: "Gagal menambah operator",
        description: err?.response?.data?.detail ?? err?.message ?? "Unknown error",
        variant: "destructive",
      }),
  })

  const updateVeh = useMutation({
    mutationFn: (p: { id: string; patch: Partial<Pick<Vehicle, "plate" | "capacityL" | "active">> }) =>
      Api.updateVehicle(p.id, p.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  })
  const deleteVeh = useMutation({
    mutationFn: Api.deleteVehicle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  })
  const createVeh = useMutation({
    mutationFn: (p: { plate: string; capacityL: number; active?: boolean }) =>
      Api.createVehicle({ plate: p.plate, capacityL: p.capacityL, active: p.active ?? true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] })
      setShowAddVeh(false)
      setNewVeh(() => ({ plate: "", capacityL: 0, active: true }))
      toast({ title: "Vehicle ditambahkan" })
    },
    onError: (err: any) =>
      toast({
        title: "Gagal menambah vehicle",
        description: err?.response?.data?.detail ?? err?.message ?? "Unknown error",
        variant: "destructive",
      }),
  })

  // ================== derived ==================
  const jobVehicles: JobVehicle[] = useMemo(() => jobDetail?.vehicles ?? [], [jobDetail])

  // ================== UI ==================
  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Assign Operator + Vehicle</h1>
        <div className="text-sm text-muted-foreground">
          {selectedJobId ? "Job selected" : "No job"} • {jobVehicles.length} RV
        </div>
      </div>

      {/* ======= Pilih Job ======= */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Pilih Job</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <SelectNative
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
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
              <span className="text-destructive">Gagal memuat jobs: {(jobsErr as Error).message}</span>
            )}
            {selectedJobId && loadingDetail && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading job summary…
              </span>
            )}
            {jobErr && (
              <span className="text-destructive">Gagal memuat job: {(jobErr as Error).message}</span>
            )}
          </div>

          {selectedJobId && jobDetail && !loadingDetail && !jobErr ? (
            <div className="text-sm text-muted-foreground">
              {jobDetail.status} · {new Date(jobDetail.created_at).toLocaleString()}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ======= Daftar RV untuk di-assign ======= */}
      {selectedJobId && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobVehicles.map((v) => {
            const rvKey = String(v.vehicle_id)
            const pick = perRV[rvKey] ?? {}
            const canAssign = !!pick.operatorId && !!pick.vehicleId

            const assignedVehPlate = vehicles.find(
              (x) => String(x.id) === String(v.assigned_vehicle_id),
            )?.plate
            const assignedOpName = operators.find(
              (x) => String(x.id) === String(v.assigned_operator_id),
            )?.name

            return (
              <Card key={rvKey} className="overflow-hidden">
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>RV #{v.vehicle_id}</span>
                    <Badge variant="secondary" className="capitalize">
                      {v.status ?? "—"}
                    </Badge>
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="text-[12px] text-muted-foreground">
                    Route time ≈ {v.route_total_time_min ?? "—"} min
                  </div>

                  {(assignedVehPlate || assignedOpName) && (
                    <div className="text-[12px] space-y-0.5">
                      {assignedVehPlate && (
                        <div>
                          Assigned Vehicle: <span className="opacity-80">{assignedVehPlate}</span>
                        </div>
                      )}
                      {assignedOpName && (
                        <div>
                          Assigned Operator: <span className="opacity-80">{assignedOpName}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Operator */}
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Operator</div>
                    <SelectNative
                      value={pick.operatorId ?? ""}
                      onChange={(e) =>
                        setPerRV((s: PerRVSelection) => ({
                          ...s,
                          [rvKey]: { ...s[rvKey], operatorId: e.target.value || undefined },
                        }))
                      }
                    >
                      <option value="">— pilih operator —</option>
                      {operators
                        .filter((o) => o.active)
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                            {o.phone ? ` (${o.phone})` : ""}
                          </option>
                        ))}
                    </SelectNative>
                  </div>

                  {/* Vehicle */}
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Vehicle</div>
                    <SelectNative
                      value={pick.vehicleId ?? ""}
                      onChange={(e) =>
                        setPerRV((s: PerRVSelection) => ({
                          ...s,
                          [rvKey]: { ...s[rvKey], vehicleId: e.target.value || undefined },
                        }))
                      }
                    >
                      <option value="">— pilih vehicle —</option>
                      {vehicles
                        .filter((vv) => vv.active)
                        .map((vv) => (
                          <option key={vv.id} value={vv.id}>
                            {vv.plate} — {vv.capacityL}L
                          </option>
                        ))}
                    </SelectNative>
                  </div>

                  {/* Status */}
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Status</div>
                    <SelectNative
                      value={pick.status ?? "planned"}
                      onChange={(e) =>
                        setPerRV((s: PerRVSelection) => ({
                          ...s,
                          [rvKey]: { ...s[rvKey], status: e.target.value || undefined },
                        }))
                      }
                    >
                      {STATUS_OPTIONS.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </SelectNative>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      disabled={!canAssign || assignMut.isPending}
                      onClick={() =>
                        assignMut.mutate({
                          jobId: selectedJobId!,
                          vid: v.vehicle_id,
                          assigned_operator_id: pick.operatorId!,
                          assigned_vehicle_id: pick.vehicleId!,
                          status: pick.status ?? "planned",
                        })
                      }
                    >
                      {assignMut.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Assigning…
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Assign
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPerRV((s: PerRVSelection) => ({ ...s, [rvKey]: {} }))}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ===================== Katalog Operators ===================== */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Operators
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">{operators.length} item</div>
            <Button variant="outline" size="sm" onClick={() => setShowAddOp(!showAddOp)}>
              {showAddOp ? "Close" : "+ Add Operator"}
            </Button>
          </div>

          {showAddOp && (
            <div className="grid md:grid-cols-4 gap-2 p-2 rounded-md border">
              <Input
                placeholder="Name"
                value={newOp.name}
                onChange={(e) => setNewOp((s) => ({ ...s, name: e.target.value }))}
              />
              <Input
                placeholder="Phone (opsional)"
                value={newOp.phone}
                onChange={(e) => setNewOp((s) => ({ ...s, phone: e.target.value }))}
              />
              <label className="flex items-center gap-2 text-sm px-2">
                <input
                  type="checkbox"
                  checked={newOp.active}
                  onChange={(e) => setNewOp((s) => ({ ...s, active: e.target.checked }))}
                />
                Active
              </label>
              <div className="flex gap-2">
                <Button
                  disabled={!newOp.name.trim() || createOp.isPending}
                  onClick={() =>
                    createOp.mutate({
                      name: newOp.name.trim(),
                      phone: newOp.phone.trim() || undefined,
                      active: newOp.active,
                    })
                  }
                >
                  {createOp.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setNewOp(() => ({ name: "", phone: "", active: true }))
                    setShowAddOp(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <ul className="divide-y rounded-md border">
            {operators.map((o) => (
              <li key={o.id} className="py-2 px-3 flex items-center gap-2 justify-between">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{o.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {o.phone ?? "—"} · {o.active ? "Active" : "Inactive"} ·{" "}
                    {new Date(o.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateOp.mutate({ id: o.id, patch: { active: !o.active } })}
                  >
                    {o.active ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Delete operator "${o.name}"?`)) deleteOp.mutate(o.id)
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ===================== Katalog Vehicles ===================== */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Vehicles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">{vehicles.length} item</div>
            <Button variant="outline" size="sm" onClick={() => setShowAddVeh(!showAddVeh)}>
              {showAddVeh ? "Close" : "+ Add Vehicle"}
            </Button>
          </div>

          {showAddVeh && (
            <div className="grid md:grid-cols-4 gap-2 p-2 rounded-md border">
              <Input
                placeholder="Plate (e.g., L123)"
                value={newVeh.plate}
                onChange={(e) => setNewVeh((s) => ({ ...s, plate: e.target.value }))}
              />
              <Input
                type="number"
                placeholder="Capacity (L)"
                value={Number.isFinite(newVeh.capacityL) ? newVeh.capacityL : 0}
                onChange={(e) =>
                  setNewVeh((s) => ({
                    ...s,
                    capacityL: e.target.value === "" ? 0 : Number(e.target.value),
                  }))
                }
              />
              <label className="flex items-center gap-2 text-sm px-2">
                <input
                  type="checkbox"
                  checked={newVeh.active}
                  onChange={(e) => setNewVeh((s) => ({ ...s, active: e.target.checked }))}
                />
                Active
              </label>
              <div className="flex gap-2">
                <Button
                  disabled={!newVeh.plate.trim() || createVeh.isPending}
                  onClick={() =>
                    createVeh.mutate({
                      plate: newVeh.plate.trim(),
                      capacityL: Number(newVeh.capacityL) || 0,
                      active: newVeh.active,
                    })
                  }
                >
                  {createVeh.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
                <Button
                    variant="outline"
                    onClick={() => {
                      setNewVeh(() => ({ plate: "", capacityL: 0, active: true }))
                      setShowAddVeh(false)
                    }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <ul className="divide-y rounded-md border">
            {vehicles.map((v) => (
              <li key={v.id} className="py-2 px-3 flex items-center gap-2 justify-between">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{v.plate}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {v.capacityL} L · {v.active ? "Active" : "Inactive"} ·{" "}
                    {new Date(v.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateVeh.mutate({ id: v.id, patch: { active: !v.active } })}
                  >
                    {v.active ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Delete vehicle "${v.plate}"?`)) deleteVeh.mutate(v.id)
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}
