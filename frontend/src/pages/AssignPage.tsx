import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Api } from "../lib/api";
import type {
  Operator,
  Vehicle,
  HistoryItem,
  JobDetail,
  JobVehicle,
} from "../types";
import { useAssignUI } from "../stores/assign";

type PerRVSelection = Record<
  string,
  { operatorId?: string; vehicleId?: string; status?: string }
>;

const STATUS_OPTIONS = ["planned", "running", "completed", "cancelled"] as const;

export default function AssignPage() {
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();

  // ======= Store (persist) =======
  const {
    selectedJobId, setSelectedJobId, perRV, setPerRV, clearPerRV,
    showAddOp, setShowAddOp, newOp, setNewOp,
    showAddVeh, setShowAddVeh, newVeh, setNewVeh,
  } = useAssignUI();

  // ================== 1) Jobs dropdown ==================
  const { data: jobs = [], isLoading: loadingJobs, error: jobsErr } = useQuery<HistoryItem[]>({
    queryKey: ["jobs-history"],
    queryFn: Api.listHistory,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });

  // Sinkronisasi selectedJobId <-> URL (?jobId=...) dan toggle add forms (?add=op|veh)
  useEffect(() => {
    const j = sp.get("jobId") ?? "";
    const add = sp.get("add") ?? "";
    if (j && j !== selectedJobId) setSelectedJobId(j);
    if (add === "op") setShowAddOp(true);
    if (add === "veh") setShowAddVeh(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const next = new URLSearchParams(sp);
    if (selectedJobId) next.set("jobId", selectedJobId);
    else next.delete("jobId");

    if (showAddOp) next.set("add", "op");
    else if (showAddVeh) next.set("add", "veh");
    else next.delete("add");

    setSp(next, { replace: true });
  }, [selectedJobId, showAddOp, showAddVeh, sp, setSp]);

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
  });

  // Kalau ganti job → reset pilihan perRV (tetap dipersist di store utk halaman lain)
  useEffect(() => {
    clearPerRV();
  }, [selectedJobId, clearPerRV]);

  // ================== 3) Catalogs ==================
  const { data: operators = [] } = useQuery<Operator[]>({
    queryKey: ["operators"],
    queryFn: Api.listOperators,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["vehicles"],
    queryFn: Api.listVehicles,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });

  // ================== 4) Mutations ==================
  const assignMut = useMutation({
    mutationFn: (p: {
      jobId: string;
      vid: string | number;
      assigned_vehicle_id?: string;
      assigned_operator_id?: string;
      status?: string;
    }) =>
      Api.assignJobVehicle(p.jobId, p.vid, {
        assigned_vehicle_id: p.assigned_vehicle_id,
        assigned_operator_id: p.assigned_operator_id,
        status: p.status,
      }),
    onSuccess: () => {
      if (selectedJobId) qc.invalidateQueries({ queryKey: ["job-detail", selectedJobId] });
    },
  });

  // katalog: operators
  const updateOp = useMutation({
    mutationFn: (p: { id: string; patch: Partial<Pick<Operator, "name" | "phone" | "active">> }) =>
      Api.updateOperator(p.id, p.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operators"] }),
  });
  const deleteOp = useMutation({
    mutationFn: Api.deleteOperator,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operators"] }),
  });
  const createOp = useMutation({
    mutationFn: (p: { name: string; phone?: string; active?: boolean }) =>
      Api.createOperator({
        name: p.name,
        phone: p.phone,
        active: p.active ?? true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operators"] });
      setShowAddOp(false);
      setNewOp(() => ({ name: "", phone: "", active: true }));
    },
  });

  // katalog: vehicles
  const updateVeh = useMutation({
    mutationFn: (p: { id: string; patch: Partial<Pick<Vehicle, "plate" | "capacityL" | "active">> }) =>
      Api.updateVehicle(p.id, p.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });
  const deleteVeh = useMutation({
    mutationFn: Api.deleteVehicle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });
  const createVeh = useMutation({
    mutationFn: (p: { plate: string; capacityL: number; active?: boolean }) =>
      Api.createVehicle({ plate: p.plate, capacityL: p.capacityL, active: p.active ?? true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      setShowAddVeh(false);
      setNewVeh(() => ({ plate: "", capacityL: 0, active: true }));
    },
  });

  // ================== derived ==================
  const jobVehicles: JobVehicle[] = useMemo(() => jobDetail?.vehicles ?? [], [jobDetail]);

  // ================== UI ==================
  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold">Assign Operator + Vehicle</h2>

      {/* ======= Pilih Job ======= */}
      <div className="rounded-xl border p-4 space-y-3">
        <div className="space-y-1">
          <label className="text-sm opacity-80">Pilih Job</label>
          <select
            className="w-full rounded-lg border px-3 py-2 bg-transparent"
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
          >
            <option value="">— pilih job —</option>
            {jobs.map((j) => (
              <option key={j.job_id} value={j.job_id}>
                {j.status} · {new Date(j.created_at).toLocaleString()} · {j.vehicle_count} vehicles
              </option>
            ))}
          </select>
          {loadingJobs && <div className="text-xs opacity-60">Loading jobs…</div>}
          {jobsErr && <div className="text-xs text-red-500">Gagal memuat jobs: {(jobsErr as Error).message}</div>}
        </div>

        {/* ======= Summary + daftar RV ======= */}
        {selectedJobId && (
          <div className="mt-3">
            {loadingDetail ? (
              <div className="text-sm opacity-70">Loading job summary…</div>
            ) : jobErr ? (
              <div className="text-sm text-red-500">Gagal memuat job: {(jobErr as Error).message}</div>
            ) : jobDetail ? (
              <div className="space-y-3">
                <div className="text-sm opacity-80">
                  {jobDetail.status} · {new Date(jobDetail.created_at).toLocaleString()}
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {jobVehicles.map((v) => {
                    // gunakan vehicle_id dari job detail sebagai 'vid' path param
                    const rvKey = String(v.vehicle_id);
                    const pick = perRV[rvKey] ?? {};
                    const canAssign = !!pick.operatorId && !!pick.vehicleId;

                    const assignedVehPlate = vehicles.find(x => String(x.id) === String(v.assigned_vehicle_id))?.plate;
                    const assignedOpName   = operators.find(x => String(x.id) === String(v.assigned_operator_id))?.name;

                    return (
                      <div key={rvKey} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">RV #{v.vehicle_id}</div>
                          <span className="text-[11px] opacity-70">{v.status}</span>
                        </div>

                        <div className="text-[11px] opacity-70">
                          Route time ≈ {v.route_total_time_min ?? "-"} min
                        </div>

                        {(assignedVehPlate || assignedOpName) && (
                          <div className="text-[12px]">
                            {assignedVehPlate && <div>Assigned Vehicle: <span className="opacity-80">{assignedVehPlate}</span></div>}
                            {assignedOpName && <div>Assigned Operator: <span className="opacity-80">{assignedOpName}</span></div>}
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="space-y-1">
                            <label className="text-xs opacity-80">Operator</label>
                            <select
                              className="w-full rounded-lg border px-2 py-1 bg-transparent text-sm"
                              value={pick.operatorId ?? ""}
                              onChange={(e) =>
                                setPerRV((s) => ({
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
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs opacity-80">Vehicle</label>
                            <select
                              className="w-full rounded-lg border px-2 py-1 bg-transparent text-sm"
                              value={pick.vehicleId ?? ""}
                              onChange={(e) =>
                                setPerRV((s) => ({
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
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs opacity-80">Status</label>
                            <select
                              className="w-full rounded-lg border px-2 py-1 bg-transparent text-sm"
                              value={pick.status ?? "planned"}
                              onChange={(e) =>
                                setPerRV((s) => ({
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
                            </select>
                          </div>

                          <div className="flex gap-2">
                            <button
                              className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-sm disabled:opacity-50"
                              disabled={!canAssign || assignMut.isPending}
                              onClick={() =>
                                assignMut.mutate({
                                  jobId: selectedJobId,
                                  vid: v.vehicle_id,
                                  assigned_operator_id: pick.operatorId!,
                                  assigned_vehicle_id: pick.vehicleId!,
                                  status: pick.status ?? "planned",
                                })
                              }
                            >
                              {assignMut.isPending ? "Assigning…" : "Assign"}
                            </button>
                            <button
                              className="px-3 py-1.5 rounded-lg border text-sm"
                              onClick={() => setPerRV((s) => ({ ...s, [rvKey]: {} }))}
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ===================== Katalog Operators ===================== */}
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Operators</div>
          <button
            className="px-2 py-1 rounded-md border text-xs"
            onClick={() => setShowAddOp(!showAddOp)}
          >
            {showAddOp ? "Close" : "+ Add Operator"}
          </button>
        </div>

        {showAddOp && (
          <div className="grid md:grid-cols-4 gap-2 p-2 rounded-lg border">
            <input
              className="rounded-lg border px-3 py-2 bg-transparent"
              placeholder="Name"
              value={newOp.name}
              onChange={(e) => setNewOp((s) => ({ ...s, name: e.target.value }))}
            />
            <input
              className="rounded-lg border px-3 py-2 bg-transparent"
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
              <button
                className="px-3 py-2 rounded-lg bg-zinc-900 text-white disabled:opacity-50"
                disabled={!newOp.name.trim() || createOp.isPending}
                onClick={() =>
                  createOp.mutate({
                    name: newOp.name.trim(),
                    phone: newOp.phone.trim() || undefined,
                    active: newOp.active,
                  })
                }
              >
                {createOp.isPending ? "Saving..." : "Save"}
              </button>
              <button
                className="px-3 py-2 rounded-lg border"
                onClick={() => {
                  setNewOp(() => ({ name: "", phone: "", active: true }));
                  setShowAddOp(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <ul className="divide-y">
          {operators.map((o) => (
            <li key={o.id} className="py-2 flex items-center gap-2 justify-between">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{o.name}</div>
                <div className="text-[11px] opacity-70">
                  {o.phone ?? "—"} · {o.active ? "Active" : "Inactive"} · {new Date(o.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  className="px-2 py-1 rounded-md border text-xs"
                  onClick={() => updateOp.mutate({ id: o.id, patch: { active: !o.active } })}
                >
                  {o.active ? "Disable" : "Enable"}
                </button>
                <button
                  className="px-2 py-1 rounded-md border text-red-600 text-xs"
                  onClick={() => {
                    if (confirm(`Delete operator "${o.name}"?`)) deleteOp.mutate(o.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ===================== Katalog Vehicles ===================== */}
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Vehicles</div>
          <button
            className="px-2 py-1 rounded-md border text-xs"
            onClick={() => setShowAddVeh(!showAddVeh)}
          >
            {showAddVeh ? "Close" : "+ Add Vehicle"}
          </button>
        </div>

        {showAddVeh && (
          <div className="grid md:grid-cols-4 gap-2 p-2 rounded-lg border">
            <input
              className="rounded-lg border px-3 py-2 bg-transparent"
              placeholder="Plate (e.g., L123)"
              value={newVeh.plate}
              onChange={(e) => setNewVeh((s) => ({ ...s, plate: e.target.value }))}
            />
            <input
              type="number"
              className="rounded-lg border px-3 py-2 bg-transparent"
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
              <button
                className="px-3 py-2 rounded-lg bg-zinc-900 text-white disabled:opacity-50"
                disabled={!newVeh.plate.trim() || createVeh.isPending}
                onClick={() =>
                  createVeh.mutate({
                    plate: newVeh.plate.trim(),
                    capacityL: Number(newVeh.capacityL) || 0,
                    active: newVeh.active,
                  })
                }
              >
                {createVeh.isPending ? "Saving..." : "Save"}
              </button>
              <button
                className="px-3 py-2 rounded-lg border"
                onClick={() => {
                  setNewVeh(() => ({ plate: "", capacityL: 0, active: true }));
                  setShowAddVeh(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <ul className="divide-y">
          {vehicles.map((v) => (
            <li key={v.id} className="py-2 flex items-center gap-2 justify-between">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{v.plate}</div>
                <div className="text-[11px] opacity-70">
                  {v.capacityL} L · {v.active ? "Active" : "Inactive"} · {new Date(v.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  className="px-2 py-1 rounded-md border text-xs"
                  onClick={() => updateVeh.mutate({ id: v.id, patch: { active: !v.active } })}
                >
                  {v.active ? "Disable" : "Enable"}
                </button>
                <button
                  className="px-2 py-1 rounded-md border text-red-600 text-xs"
                  onClick={() => {
                    if (confirm(`Delete vehicle "${v.plate}"?`)) deleteVeh.mutate(v.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
