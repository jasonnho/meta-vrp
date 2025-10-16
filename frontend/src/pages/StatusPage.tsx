import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Api } from "../lib/api";
import type { RouteStatus } from "../types";

export default function StatusPage() {
  const [rvId, setRvId] = useState<number>(0);
  const [status, setStatus] = useState<RouteStatus>("pending");
  const mutate = useMutation({ mutationFn: () => Api.updateRouteStatus(rvId, status) });

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Update Route Status</h2>

      <div className="flex gap-2 items-center">
        <input type="number" className="input" value={rvId}
               onChange={e => setRvId(Number(e.target.value))} />
        <select className="input" value={status}
                onChange={e => setStatus(e.target.value as RouteStatus)}>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
          <option value="issue">Issue</option>
        </select>
        <button className="px-3 py-2 rounded-lg bg-zinc-900 text-white"
                onClick={() => mutate.mutate()}>
          Update
        </button>
        {mutate.isSuccess && <span className="text-green-600">Updated!</span>}
      </div>
    </section>
  );
}
