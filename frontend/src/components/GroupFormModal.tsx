import { useEffect, useState } from "react";

type NodeLite = { id: string; name?: string };
type Props = {
  open: boolean;
  initial?: { name: string; nodeIds: string[]; description?: string | null };
  allNodes: NodeLite[];
  onClose: () => void;
  onSubmit: (v: { name: string; nodeIds: string[]; description?: string | null }) => void;
};

export default function GroupFormModal({ open, initial, allNodes, onClose, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [ids, setIds] = useState<string[]>(initial?.nodeIds ?? []);
  const [description, setDescription] = useState<string>(initial?.description ?? ""); // ⬅️ baru

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setIds(initial?.nodeIds ?? []);
      setDescription(initial?.description ?? "");
    }
  }, [open, initial]);

  const toggle = (id: string) =>
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-zinc-900 p-4 space-y-4">
        <div className="text-lg font-semibold">{initial ? "Edit Group" : "New Group"}</div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group name"
          className="w-full rounded-lg border px-3 py-2 bg-transparent"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (opsional)"
          rows={3}
          className="w-full rounded-lg border px-3 py-2 bg-transparent"
        />

        <div className="max-h-64 overflow-auto border rounded-lg">
          <ul className="divide-y">
            {allNodes.map((n) => (
              <li key={n.id} className="flex items-center gap-2 px-3 py-2">
                <input type="checkbox" checked={ids.includes(n.id)} onChange={() => toggle(n.id)} />
                <span className="text-sm">{n.name ?? n.id}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border">Cancel</button>
          <button
            onClick={() => onSubmit({ name: name.trim(), nodeIds: ids, description: description.trim() || null })}
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white disabled:opacity-50"
            disabled={!name.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
