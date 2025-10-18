import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Api } from "../lib/api";
import type { HistoryItem, JobDetail, JobStatus } from "../types";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import { minutesToHHMM } from "../lib/format";
import { useLogsUI } from "../stores/logs";

// helper: YYYY-MM-DD lokal
function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

export default function LogsPage() {
  const { status, setStatus, fromDate, setFromDate, toDate, setToDate } = useLogsUI();
  const [sp, setSp] = useSearchParams();

  // ===== Sinkronisasi Filter <-> URL =====
  // Baca dari URL saat pertama kali mount
  useEffect(() => {
    const s = (sp.get("status") ?? "").toLowerCase();
    const f = sp.get("from") ?? "";
    const t = sp.get("to") ?? "";

    // validasi status
    const allowed: Array<"ALL" | JobStatus> = ["ALL", "planned", "running", "succeeded", "failed", "cancelled"];
    const normalized = s ? (allowed.includes(s as any) ? (s as any) : "ALL") : "ALL";

    if (normalized !== status) setStatus(normalized);
    if (f && f !== fromDate) setFromDate(f);
    if (t && t !== toDate) setToDate(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tulis ke URL ketika filter berubah
  useEffect(() => {
    const next = new URLSearchParams(sp);
    if (status && status !== "ALL") next.set("status", status);
    else next.delete("status");

    if (fromDate) next.set("from", fromDate);
    else next.delete("from");

    if (toDate) next.set("to", toDate);
    else next.delete("to");

    setSp(next, { replace: true });
  }, [status, fromDate, toDate, sp, setSp]);

  // ===== Data: daftar jobs =====
  const q = useQuery<HistoryItem[]>({
    queryKey: ["jobs-history"],            // konsisten dengan halaman lain
    queryFn: Api.listHistory,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });

  const rows = useMemo(() => {
    const items = q.data ?? [];
    const st = status === "ALL" ? null : String(status).toLowerCase();

    return items.filter((it) => {
      const okStatus = st ? String(it.status).toLowerCase() === st : true;
      const d = new Date(it.created_at);
      const dateStr = ymdLocal(d);
      const afterFrom = !fromDate || dateStr >= fromDate;
      const beforeTo = !toDate || dateStr <= toDate;
      return okStatus && afterFrom && beforeTo;
    });
  }, [q.data, status, fromDate, toDate]);

  // ===== Detail: pakai URL param ?detail=<jobId> agar state tetap survive & shareable =====
  const selectedId = sp.get("detail");
  const open = !!selectedId;

  const detailQ = useQuery<JobDetail>({
    queryKey: ["job-detail", selectedId],
    queryFn: () => Api.getJobDetail(selectedId as string),
    enabled: !!selectedId,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  });

  const openDetail = (id: string) => {
    const next = new URLSearchParams(sp);
    next.set("detail", id);
    setSp(next, { replace: false });
  };
  const closeDetail = () => {
    const next = new URLSearchParams(sp);
    next.delete("detail");
    setSp(next, { replace: true });
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">History</h2>

      {/* Filter */}
      <div className="card">
        <div className="card-h">Filter</div>
        <div className="card-b grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs mb-1 opacity-70">Status</label>
            <select
              className="input w-full"
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
            <label className="block text-xs mb-1 opacity-70">From</label>
            <input
              type="date"
              className="input w-full"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs mb-1 opacity-70">To</label>
            <input
              type="date"
              className="input w-full"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Tabel */}
      <div className="card overflow-hidden">
        <div className="card-h flex items-center justify-between">
          <span>Riwayat Optimasi</span>
          {q.isFetching && <span className="text-xs opacity-70">Loading…</span>}
        </div>

        <div className="card-b p-0">
          {q.isError ? (
            <div className="p-4 text-red-600 text-sm">
              Gagal memuat history:{" "}
              {(q.error as any)?.response?.data?.detail ??
                (q.error as any)?.message ??
                "Unknown error"}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-sm opacity-70 text-center">Belum ada history.</div>
          ) : (
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-zinc-100 dark:bg-zinc-900">
                <tr>
                  <th className="text-left p-2 w-[220px]">Time</th>
                  <th className="text-left p-2 w-[140px]">Status</th>
                  <th className="text-left p-2 w-[160px]">Kendaraan</th>
                  <th className="text-left p-2 w-[160px]">Titik Disiram</th>
                  <th className="text-left p-2 w-[120px]">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((it) => {
                  const points =
                    (it as any).points_count ??
                    (it as any).served_points ??
                    (it as any).points_total ??
                    (it as any).node_count ??
                    "—";
                  return (
                    <tr
                      key={it.job_id}
                      className="border-t border-zinc-200 dark:border-zinc-800"
                    >
                      <td className="p-2 whitespace-nowrap">
                        {new Date(it.created_at).toLocaleString()}
                      </td>
                      <td className="p-2">
                        <StatusBadge status={it.status} />
                      </td>
                      <td className="p-2">{it.vehicle_count}</td>
                      <td className="p-2">{points}</td>
                      <td className="p-2">
                        <button
                          className="btn-ghost"
                          onClick={() => openDetail(it.job_id)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Detail */}
      <Modal open={open} onClose={closeDetail} title="Job Details">
        {!selectedId ? (
          <div className="text-sm opacity-70">No job selected.</div>
        ) : detailQ.isLoading ? (
          <div className="text-sm opacity-70">Loading details…</div>
        ) : detailQ.isError ? (
          <div className="text-sm text-red-600">
            Gagal memuat detail:{" "}
            {(detailQ.error as any)?.response?.data?.detail ??
              (detailQ.error as any)?.message ??
              "Unknown error"}
          </div>
        ) : detailQ.data ? (
          <DetailsContent detail={detailQ.data} />
        ) : null}
      </Modal>
    </section>
  );
}

function DetailsContent({ detail }: { detail: JobDetail }) {
  const vehicles = detail.vehicles ?? [];
  const routes = detail.routes ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <div className="opacity-70">Job ID</div>
          <div className="font-mono text-xs">{detail.job_id}</div>
        </div>
        <div>
          <div className="opacity-70">Created At</div>
          <div>{new Date(detail.created_at).toLocaleString()}</div>
        </div>
        <div>
          <div className="opacity-70">Status</div>
          <div className="capitalize">{detail.status}</div>
        </div>
      </div>

      {/* Kendaraan & Operator */}
      <div className="space-y-2">
        <div className="font-medium">Kendaraan & Operator</div>
        {vehicles.length === 0 ? (
          <div className="text-sm opacity-70">Tidak ada data kendaraan.</div>
        ) : (
          <div className="overflow-auto -mx-2">
            <table className="min-w-[760px] w-full text-sm">
              <thead className="bg-zinc-100 dark:bg-zinc-900">
                <tr>
                  <th className="text-left p-2">Vehicle</th>
                  <th className="text-left p-2">Nopol</th>
                  <th className="text-left p-2">Operator</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Durasi Rute</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v, i) => (
                  <tr key={`${v.vehicle_id}-${i}`} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="p-2">#{v.vehicle_id}</td>
                    <td className="p-2">{v.plate ?? "—"}</td>
                    <td className="p-2">{v.operator?.name ?? "—"}</td>
                    <td className="p-2 capitalize">{v.status ?? "—"}</td>
                    <td className="p-2">
                      {typeof v.route_total_time_min === "number"
                        ? `${v.route_total_time_min} min (${minutesToHHMM(v.route_total_time_min)})`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rute */}
      <div className="space-y-2">
        <div className="font-medium">Rute</div>
        {routes.length === 0 ? (
          <div className="text-sm opacity-70">Rute belum tersedia.</div>
        ) : (
          <div className="space-y-3">
            {routes.map((r, idx) => (
              <div key={`${r.vehicle_id}-${idx}`} className="card">
                <div className="card-h">
                  Vehicle #{r.vehicle_id}
                  {typeof r.total_time_min === "number" && (
                    <span className="ml-2 opacity-70 text-xs">
                      {r.total_time_min} min ({minutesToHHMM(r.total_time_min)})
                    </span>
                  )}
                </div>
                <div className="card-b space-y-2">
                  <div className="font-mono text-xs break-all">
                    {r.sequence.join(" → ")}
                  </div>

                  {/* Per-step dengan status & reason */}
                  {(() => {
                    const v = vehicles.find(v => String(v.vehicle_id) === String(r.vehicle_id));
                    const steps = v?.route ?? [];
                    if (!steps?.length) return null;
                    return (
                      <div className="overflow-auto -mx-2">
                        <table className="min-w-[500px] w-full text-xs">
                          <thead className="bg-zinc-100 dark:bg-zinc-900">
                            <tr>
                              <th className="text-left p-2 w-16">Idx</th>
                              <th className="text-left p-2 w-32">Node</th>
                              <th className="text-left p-2 w-28">Status</th>
                              <th className="text-left p-2">Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {steps
                              .slice()
                              .sort((a, b) => (a.sequence_index ?? 0) - (b.sequence_index ?? 0))
                              .map(s => (
                                <tr key={s.sequence_index} className="border-t border-zinc-200 dark:border-zinc-800">
                                  <td className="p-2">{s.sequence_index}</td>
                                  <td className="p-2">{s.node_id}</td>
                                  <td className="p-2 capitalize">{s.status ?? "—"}</td>
                                  <td className="p-2">{s.reason ?? "—"}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
