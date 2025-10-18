// src/pages/OptimizePage.tsx
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Api } from "../lib/api";
import type { OptimizeResponse, Node, Group } from "../types";
import { minutesToHHMM } from "../lib/format";
import NodesMapSelector from "../components/NodesMapSelector";

export default function OptimizePage() {
  // default: 0 kendaraan (sesuai permintaan)
  const [maxVehicles, setMaxVehicles] = useState<number>(0);

  // data nodes & groups
  const nodesQ = useQuery({ queryKey: ["nodes"], queryFn: Api.listNodes });
  const groupsQ = useQuery<Group[]>({ queryKey: ["groups"], queryFn: Api.listGroups });

  // selection titik (default: kosong)
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const selectAllParks = () => {
    if (!nodesQ.data) return;
    const parks = nodesQ.data.filter((n: any) => n.kind === "park").map((n: any) => n.id);
    setSelected(new Set(parks));
  };
  const selectAll = () => {
    if (!nodesQ.data) return;
    setSelected(new Set(nodesQ.data.map((n: any) => n.id)));
  };
  const clearAll = () => setSelected(new Set());

  // apply group → replace selection
  const applyGroup = (g: Group) => {
    setSelected(new Set(g.nodeIds ?? []));
  };

  const optimize = useMutation({
    mutationFn: (payload: any) => Api.optimize(payload),
  });

  const handleRun = () => {
    const node_ids = Array.from(selected);
    optimize.mutate({
      num_vehicles: maxVehicles,
      selected_node_ids: node_ids,
    });
  };

  const data: OptimizeResponse | undefined = optimize.data;

  // ringkasan
  const summary = useMemo(() => {
    if (!data) return null;
    const totRoute = data.routes.length;
    const totSeq = data.routes.reduce((s, r) => s + r.sequence.length, 0);
    return { totRoute, totSeq };
  }, [data]);

  const canRun = !optimize.isPending && maxVehicles > 0 && selected.size > 0;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Optimize</h2>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* kiri: map */}
        <div className="lg:col-span-8 card">
          <div className="card-h">Pilih Titik</div>
          <div className="card-b">
            {nodesQ.isLoading && <div>Loading points…</div>}
            {nodesQ.isError && <div className="text-red-600">Failed to load nodes.</div>}
            {nodesQ.data && (
              <NodesMapSelector
                nodes={nodesQ.data as Node[]}
                selected={selected}
                onToggle={toggle}
              />
            )}
          </div>
        </div>

        {/* kanan: controls + groups + summary */}
        <div className="lg:col-span-4 space-y-4">
          {/* Pengaturan */}
          <div className="card">
            <div className="card-h">Pengaturan</div>
            <div className="card-b space-y-3">
              <div>
                <label className="block text-xs mb-1 opacity-70">Max Vehicles</label>
                <input
                  type="number"
                  min={0}
                  className="input w-full"
                  value={maxVehicles}
                  onChange={(e) => setMaxVehicles(Number(e.target.value))}
                />
              </div>

              <div className="text-sm opacity-70">
                Selected points: <b>{selected.size}</b>
              </div>

              <div className="flex flex-wrap gap-2">
                {/* <button className="btn-ghost" onClick={selectAllParks}>Select all (parks)</button> */}
                <button className="btn-ghost" onClick={selectAll}>Select all</button>
                <button className="btn-ghost" onClick={clearAll}>Clear</button>
              </div>

              <button
                className="btn w-full"
                disabled={!canRun}
                onClick={handleRun}
              >
                {optimize.isPending ? "Running…" : "Run Optimization"}
              </button>

              {optimize.isError && (
                <div className="text-red-600 text-xs">
                  {(optimize.error as any)?.response?.data?.detail ??
                    (optimize.error as any)?.message ??
                    "Failed."}
                </div>
              )}
            </div>
          </div>

          {/* Groups */}
          <div className="card">
            <div className="card-h">Groups</div>
            <div className="card-b">
              {groupsQ.isLoading ? (
                <div className="text-sm opacity-70">Loading groups…</div>
              ) : groupsQ.isError ? (
                <div className="text-sm text-red-600">Failed to load groups.</div>
              ) : (groupsQ.data ?? []).length === 0 ? (
                <div className="text-sm opacity-70">Belum ada group.</div>
              ) : (
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {groupsQ.data!.map((g) => (
                    <li key={g.id} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{g.name}</div>
                        <div className="text-xs opacity-70">{g.nodeIds?.length ?? 0} points</div>
                        {g.description ? (
                          <div className="text-[11px] opacity-70 truncate">{g.description}</div>
                        ) : null}
                      </div>
                      <div className="shrink-0">
                        <button
                          className="px-2 py-1 rounded-md bg-zinc-900 text-white text-xs"
                          onClick={() => applyGroup(g)}
                          title="Apply group (replace selection)"
                        >
                          Apply
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Ringkasan hasil (kalau ada) */}
          {data && (
            <div className="card">
              <div className="card-h">Ringkasan</div>
              <div className="card-b text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="opacity-70">Objective (min)</span>
                  <b>
                    {data.objective_time_min} ({minutesToHHMM(data.objective_time_min)})
                  </b>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Vehicles Used</span>
                  <b>{data.vehicle_used}</b>
                </div>
                {summary && (
                  <div className="flex justify-between">
                    <span className="opacity-70">Total Steps</span>
                    <b>{summary.totSeq}</b>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* tabel rute */}
      {data?.routes?.length ? (
        <div className="card overflow-hidden">
          <div className="card-h">Rute Per Kendaraan</div>
          <div className="card-b p-0">
            <table className="min-w-[800px] w-full text-sm">
              <thead className="bg-zinc-100 dark:bg-zinc-900">
                <tr>
                  <th className="text-left p-2">Vehicle</th>
                  <th className="text-left p-2">Total Time</th>
                  <th className="text-left p-2">Sequence</th>
                  <th className="text-left p-2">Load</th>
                </tr>
              </thead>
              <tbody>
                {data.routes.map((r) => (
                  <tr key={r.vehicle_id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="p-2">#{r.vehicle_id}</td>
                    <td className="p-2">
                      {r.total_time_min} ({minutesToHHMM(r.total_time_min)})
                    </td>
                    <td className="p-2 font-mono text-xs break-all">
                      {r.sequence.join(" → ")}
                    </td>
                    <td className="p-2 font-mono text-xs">
                      [{r.load_profile_liters.join(", ")}]
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
