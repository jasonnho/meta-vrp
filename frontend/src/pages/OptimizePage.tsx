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
      setSelected(new Set(nodesQ.data.map((n) => n.id)));
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
    setSelected(new Set(nodesQ.data.map((n) => n.id)));
  };
  const clearAll = () => setSelected(new Set());

  const optimize = useMutation({
    mutationFn: (payload: any) => Api.optimize(payload),
  });

  const handleRun = () => {
    const node_ids = Array.from(selected);
    optimize.mutate({
      max_vehicles: maxVehicles,
      node_ids,  // <<<<<<<<<<<<<< kirim titik yang dipilih
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
    <section className="space-y-5">
      <h2 className="text-lg font-semibold">Optimize</h2>

      {/* controls */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs mb-1 opacity-70">Max Vehicles</label>
          <input
            type="number"
            value={maxVehicles}
            onChange={(e) => setMaxVehicles(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
            min={1}
          />
        </div>

        <div className="flex gap-2">
          <button onClick={selectAll} className="px-3 py-2 rounded-lg border">
            Select all
          </button>
          <button onClick={clearAll} className="px-3 py-2 rounded-lg border">
            Clear
          </button>
          <button
            disabled={optimize.isPending || selected.size === 0}
            onClick={handleRun}
            className="px-4 py-2 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-60"
          >
            {optimize.isPending ? "Running…" : "Run Optimization"}
          </button>
        </div>

        <div className="text-sm opacity-70">
          Selected points: <b>{selected.size}</b>
        </div>
      </div>

      {/* map selector */}
      <div>
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

      {/* hasil ringkas */}
      {data && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="text-sm flex gap-6 flex-wrap">
            <div>
              <span className="opacity-70">Objective (min):</span>{" "}
              <b>{data.objective_time_min}</b> ({minutesToHHMM(data.objective_time_min)})
            </div>
            <div>
              <span className="opacity-70">Vehicles Used:</span> <b>{data.vehicle_used}</b>
            </div>
            {summary && (
              <div className="opacity-70">
                {summary.totRoute} routes • {summary.totSeq} stops total
              </div>
            )}
          </div>
        </div>
      )}

      {/* tabel rute */}
      {data?.routes && data.routes.length > 0 && (
        <div className="overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-[800px] w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                <th className="text-left p-2">Vehicle</th>
                <th className="text-left p-2">Total Time</th>
                <th className="text-left p-2">Sequence</th>
                <th className="text-left p-2">Load Profile</th>
              </tr>
            </thead>
            <tbody>
              {data.routes.map((r) => (
                <tr key={r.vehicle_id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="p-2">#{r.vehicle_id}</td>
                  <td className="p-2">
                    {r.total_time_min} min ({minutesToHHMM(r.total_time_min)})
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
      )}

      {/* error */}
      {optimize.isError && (
        <div className="text-red-600 text-sm">
          {(optimize.error as any)?.message ?? "Optimization failed."}
        </div>
      )}
    </section>
  );
}
