import type { JobStatus } from "../types";

function pickCls(s: string) {
  const base = "badge";
  const map: Record<string, string> = {
    planned:   "border-zinc-400 text-zinc-600",
    running:   "border-sky-500 text-sky-600",
    succeeded: "border-emerald-500 text-emerald-600",
    success:   "border-emerald-500 text-emerald-600",
    failed:    "border-red-500 text-red-600",
    error:     "border-red-500 text-red-600",
    cancelled: "border-amber-500 text-amber-600",
  };
  const key = s.toLowerCase();
  return `${base} ${map[key] ?? "border-zinc-400 text-zinc-600"}`;
}

export default function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={pickCls(status)}>{status}</span>;
}
