// src/pages/StatusPage.tsx
import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Api } from "../lib/api";
import type { HistoryItem, JobDetail, JobVehicle, JobRouteStep } from "../types";
import { useStatusUI } from "../stores/status";

const VEHICLE_STATUS = ["planned", "in_progress", "done", "done_with_issues", "cancelled"] as const;
// Opsi generik untuk titik. Ganti sesuai enum backend jika perlu.
const STEP_STATUS = ["planned", "visited", "skipped", "failed"] as const;

export default function StatusPage() {
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();

  // ===== Store (persist) =====
  const {
    selectedJobId,
    setSelectedJobId,
    perVeh,
    setPerVeh,
    perStep,
    setPerStep,
    clearPicks,
  } = useStatusUI();

  // ===== 1) Pilih Job =====
  const {
    data: jobs = [],
    isLoading: loadingJobs,
    error: jobsErr,
  } = useQuery<HistoryItem[]>({
    queryKey: ["jobs-history"],
    queryFn: Api.listHistory,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });

  // Sinkronisasi selectedJobId <-> URL (?jobId=...)
  useEffect(() => {
    const q = sp.get("jobId") ?? "";
    if (q && q !== selectedJobId) setSelectedJobId(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const next = new URLSearchParams(sp);
    if (selectedJobId) next.set("jobId", selectedJobId);
    else next.delete("jobId");
    setSp(next, { replace: true });
  }, [selectedJobId, sp, setSp]);

  // ===== 2) Detail Job =====
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

  const vehicles: JobVehicle[] = useMemo(
    () => jobDetail?.vehicles ?? [],
    [jobDetail]
  );

  // ===== 3) Mutations =====

  // PATCH /jobs/{job_id}/vehicles/{vid}  body { status }
  const updateVehicleStatus = useMutation({
    mutationFn: (p: { jobId: string; vid: string | number; status: string }) =>
      Api.assignJobVehicle(p.jobId, p.vid, { status: p.status }),
    onSuccess: () => {
      if (selectedJobId)
        qc.invalidateQueries({ queryKey: ["job-detail", selectedJobId] });
    },
  });

  // PATCH /jobs/{job_id}/vehicles/{vid}/steps/{seq}  body { status, reason? }
  const updateStepStatus = useMutation({
    mutationFn: (p: {
      jobId: string;
      vid: string | number;
      seq: number | string;
      status: string;
      reason?: string;
    }) =>
      Api.updateJobVehicleStepStatus(p.jobId, p.vid, p.seq, {
        status: p.status,
        ...(p.reason ? { reason: p.reason } : {}),
      }),
    onSuccess: () => {
      if (selectedJobId)
        qc.invalidateQueries({ queryKey: ["job-detail", selectedJobId] });
    },
  });

  // ===== helpers =====
  const stepKey = (vid: string | number, seq: number | string) => `${vid}:${seq}`;

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold">Status — Vehicles & Stops</h2>

      {/* ===== Pilih Job ===== */}
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
                {j.job_id} · {j.status} ·{" "}
                {new Date(j.created_at).toLocaleString()} · {j.vehicle_count} vehicles
              </option>
            ))}
          </select>
          {loadingJobs && <div className="text-xs opacity-60">Loading jobs…</div>}
          {jobsErr && (
            <div className="text-xs text-red-500">
              Gagal memuat jobs: {(jobsErr as Error).message}
            </div>
          )}
        </div>

        {/* ===== Summary & Vehicles ===== */}
        {selectedJobId && (
          <div className="mt-3">
            {loadingDetail ? (
              <div className="text-sm opacity-70">Loading job summary…</div>
            ) : jobErr ? (
              <div className="text-sm text-red-500">Gagal memuat job: {(jobErr as Error).message}</div>
            ) : jobDetail ? (
              <div className="space-y-4">
                <div className="text-sm opacity-80">
                  Job <span className="font-mono">{jobDetail.job_id}</span> · {jobDetail.status} ·{" "}
                  {new Date(jobDetail.created_at).toLocaleString()}
                </div>

                {/* ===== Cards per Vehicle ===== */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {vehicles.map((v) => {
                    const vid = String(v.vehicle_id);
                    const vehPick = perVeh[vid] ?? {};
                    const currentVehStatus = v.status ?? "-";
                    const steps: JobRouteStep[] = Array.isArray(v.route) ? (v.route as JobRouteStep[]) : [];

                    return (
                      <div key={vid} className="rounded-lg border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">Vehicle #{v.vehicle_id}</div>
                          <span className="text-[11px] opacity-70">Vehicle status: {currentVehStatus}</span>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          {/* Update status vehicle */}
                          <div className="space-y-1">
                            <label className="text-xs opacity-80">Update Vehicle Status</label>
                            <div className="flex gap-2">
                              <select
                                className="flex-1 rounded-lg border px-2 py-1 bg-transparent text-sm"
                                value={vehPick.status ?? v.status ?? "planned"}
                                onChange={(e) =>
                                  setPerVeh((s) => ({
                                    ...s,
                                    [vid]: { ...(s[vid] ?? {}), status: e.target.value },
                                  }))
                                }
                              >
                                {VEHICLE_STATUS.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                              <button
                                className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-sm disabled:opacity-50"
                                disabled={!perVeh[vid]?.status || updateVehicleStatus.isPending}
                                onClick={() =>
                                  updateVehicleStatus.mutate({
                                    jobId: selectedJobId,
                                    vid,
                                    status: perVeh[vid]?.status ?? v.status ?? "planned",
                                  })
                                }
                              >
                                {updateVehicleStatus.isPending ? "Saving…" : "Save"}
                              </button>
                            </div>
                          </div>

                          {/* Tabel steps */}
                          <div className="space-y-1">
                            <div className="text-xs font-medium opacity-80">Route Steps</div>
                            <div className="border rounded-lg overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-zinc-50 dark:bg-zinc-900/40">
                                  <tr>
                                    <th className="text-left px-2 py-1">#</th>
                                    <th className="text-left px-2 py-1">Node</th>
                                    <th className="text-left px-2 py-1">Status</th>
                                    <th className="text-left px-2 py-1 w-56">Update</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {steps
                                    .slice()
                                    .sort(
                                      (a: JobRouteStep, b: JobRouteStep) =>
                                        (a.sequence_index ?? 0) - (b.sequence_index ?? 0)
                                    )
                                    .map((s: JobRouteStep) => {
                                      const seq = s.sequence_index ?? 0;
                                      const key = stepKey(vid, seq);
                                      const pickStatus = perStep[key]?.status ?? s.status ?? "planned";
                                      const pickReason = perStep[key]?.reason ?? "";

                                      return (
                                        <tr key={key} className="border-t align-top">
                                          <td className="px-2 py-1">{seq}</td>
                                          <td className="px-2 py-1 font-mono">{String(s.node_id)}</td>
                                          <td className="px-2 py-1">{s.status ?? "-"}</td>
                                          <td className="px-2 py-1">
                                            <div className="flex flex-col gap-1">
                                              <div className="flex gap-2">
                                                <select
                                                  className="flex-1 rounded-lg border px-2 py-1 bg-transparent"
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
                                                </select>
                                                <button
                                                  className="px-2 rounded-md border disabled:opacity-50"
                                                  disabled={updateStepStatus.isPending}
                                                  onClick={() =>
                                                    updateStepStatus.mutate({
                                                      jobId: selectedJobId,
                                                      vid,
                                                      seq, // pakai sequence index
                                                      status: perStep[key]?.status ?? s.status ?? "planned",
                                                      reason: perStep[key]?.reason || undefined, // opsional
                                                    })
                                                  }
                                                >
                                                  Set
                                                </button>
                                              </div>

                                              {/* Reason (opsional) */}
                                              <input
                                                className="rounded-lg border px-2 py-1 bg-transparent"
                                                placeholder="Reason (opsional)"
                                                value={pickReason}
                                                onChange={(e) =>
                                                  setPerStep((st) => ({
                                                    ...st,
                                                    [key]: { ...(st[key] ?? {}), reason: e.target.value },
                                                  }))
                                                }
                                              />
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  {steps.length === 0 && (
                                    <tr>
                                      <td className="px-2 py-3 text-center opacity-70" colSpan={4}>
                                        No steps.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
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
    </section>
  );
}
