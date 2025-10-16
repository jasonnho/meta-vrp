import { useQuery } from "@tanstack/react-query";
import { Api } from "../lib/api";

export default function LogsPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["logs"], queryFn: Api.listLogs });

  if (isLoading) return <div>Loading…</div>;
  if (isError)   return <div>Failed to load logs.</div>;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">History / Logs</h2>
      <div className="overflow-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
        <table className="min-w-[600px] w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="text-left p-2">Time</th>
              <th className="text-left p-2">Level</th>
              <th className="text-left p-2">Message</th>
            </tr>
          </thead>
          <tbody>
          {(data ?? []).map(l => (
            <tr key={l.id} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="p-2">{new Date(l.time_iso).toLocaleString()}</td>
              <td className="p-2">{l.level}</td>
              <td className="p-2">{l.message}</td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
