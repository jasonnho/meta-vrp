import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Api } from "../lib/api";
import type { OptimizeResponse, Node } from "../types";
import { minutesToHHMM } from "../lib/format";
import NodesMapSelector from "../components/NodesMapSelector";

export default function OptimizePage() {
  const [maxVehicles, setMaxVehicles] = useState<number>(4);

  // ambil nodes dari backend
  const nodesQ = useQuery({ queryKey: ["nodes"], queryFn: Api.listNodes });

  // set terpilih (default: semua terpilih)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
  if (nodesQ.data && nodesQ.data.length && selected.size === 0) {
    const onlyParks = nodesQ.data.filter(n => n.kind === "park").map(n => n.id);
    setSelected(new Set(onlyParks));
  }
}, [nodesQ.data]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const selectAll = () => {
  if (!nodesQ.data) return;
  const onlyParks = nodesQ.data.filter(n => n.kind === "park").map(n => n.id);
  setSelected(new Set(onlyParks));
};
  const clearAll = () => setSelected(new Set());

  const optimize = useMutation({
    mutationFn: (payload: any) => Api.optimize(payload),
  });

  const handleRun = () => {
    const node_ids = Array.from(selected);
    optimize.mutate({
      num_vehicles: maxVehicles,        // ✅ backend expects this
      selected_node_ids: node_ids,      // <<<<<<<<<<<<<< kirim titik yang dipilih
    });
  };

  const data: OptimizeResponse | undefined = optimize.data;

  // hitung ringkas
  const summary = useMemo(() => {
    if (!data) return null;
    const totRoute = data.routes.length;
    const totSeq = data.routes.reduce((s, r) => s + r.sequence.length, 0);
    return { totRoute, totSeq };
  }, [data]);

 return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Optimize</h2>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* kiri: map */}
        <div className="lg:col-span-8 card">
          <div className="card-h">Pilih Titik (Park)</div>
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

        {/* kanan: controls + summary */}
        <div className="lg:col-span-4 space-y-4">
          <div className="card">
            <div className="card-h">Pengaturan</div>
            <div className="card-b space-y-3">
              <div>
                <label className="block text-xs mb-1 opacity-70">Max Vehicles</label>
                <input type="number" min={1} className="input w-full"
                  value={maxVehicles} onChange={e=>setMaxVehicles(Number(e.target.value))}/>
              </div>
              <div className="text-sm opacity-70">
                Selected points: <b>{selected.size}</b>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={selectAll}>Select all</button>
                <button className="btn-ghost" onClick={clearAll}>Clear</button>
              </div>
              <button className="btn w-full"
                disabled={optimize.isPending || selected.size===0}
                onClick={handleRun}>
                {optimize.isPending ? "Running…" : "Run Optimization"}
              </button>
              {optimize.isError && (
                <div className="text-red-600 text-xs">
                  {(optimize.error as any)?.response?.data?.detail
                    ?? (optimize.error as any)?.message
                    ?? "Failed."}
                </div>
              )}
            </div>
          </div>

          {data && (
            <div className="card">
              <div className="card-h">Ringkasan</div>
              <div className="card-b text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="opacity-70">Objective (min)</span>
                  <b>{data.objective_time_min} ({minutesToHHMM(data.objective_time_min)})</b>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Vehicles Used</span>
                  <b>{data.vehicle_used}</b>
                </div>
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
                {data.routes.map(r=>(
                  <tr key={r.vehicle_id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="p-2">#{r.vehicle_id}</td>
                    <td className="p-2">{r.total_time_min} ({minutesToHHMM(r.total_time_min)})</td>
                    <td className="p-2 font-mono text-xs break-all">{r.sequence.join(" → ")}</td>
                    <td className="p-2 font-mono text-xs">[{r.load_profile_liters.join(", ")}]</td>
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
