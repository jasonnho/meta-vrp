import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Api } from "../lib/api";
import type { Group } from "../types";
import GroupFormModal from "../components/GroupFormModal";
import { useAllNodes } from "../hooks/useAllNodes";

export default function GroupsPage() {
  const qc = useQueryClient();

  const { data: groups = [], isLoading, error } = useQuery<Group[]>({
    queryKey: ["groups"],
    queryFn: Api.listGroups,
  });

  const { data: allNodes = [] } = useAllNodes();

  const create = useMutation({
    mutationFn: Api.createGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });

  const update = useMutation({
    mutationFn: (p: { id: string; patch: Partial<Pick<Group, "name" | "nodeIds" | "description">> }) =>
      Api.updateGroup(p.id, p.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });

  const remove = useMutation({
    mutationFn: Api.deleteGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });

  const [openModal, setOpenModal] = useState<null | { mode: "new" } | { mode: "edit"; g: Group }>(null);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Groups</h2>

      <div className="flex gap-2">
        <button className="px-3 py-2 rounded-lg bg-zinc-900 text-white" onClick={() => setOpenModal({ mode: "new" })}>
          + New Group
        </button>
      </div>

      {isLoading ? (
        "Loading..."
      ) : groups.length > 0 ? (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {groups.map((g) => (
            <li key={g.id} className="py-2 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium truncate">{g.name}</div>
                {g.description ? (
                  <div className="text-xs opacity-80 truncate">{g.description}</div>
                ) : null}
                <div className="text-xs opacity-70">{g.nodeIds?.length ?? 0} points</div>
                <div className="text-xs opacity-50">
                  {g.createdAt ? new Date(g.createdAt).toLocaleString() : "-"}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button className="px-2 py-1 rounded-md border text-xs" onClick={() => setOpenModal({ mode: "edit", g })}>
                  Edit
                </button>
                <button
                  className="px-2 py-1 rounded-md border text-red-600 text-xs"
                  onClick={() => {
                    if (confirm(`Delete group "${g.name}"?`)) remove.mutate(g.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed p-6 text-center">
          {error ? (
            <div className="text-sm text-red-500">Failed to load groups: {(error as Error).message}</div>
          ) : (
            <>
              <div className="text-sm opacity-70 mb-3">Belum ada group.</div>
              <div className="flex justify-center gap-2">
                <button
                  className="px-3 py-2 rounded-lg bg-zinc-900 text-white"
                  onClick={() => create.mutate({ name: `Group ${Date.now() % 1000}`, nodeIds: [], description: null })}
                >
                  + Quick Create
                </button>
                <button className="px-3 py-2 rounded-lg border" onClick={() => setOpenModal({ mode: "new" })}>
                  + New Group (pilih titik)
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {openModal && (
        <GroupFormModal
          open
          initial={
            openModal.mode === "edit"
              ? { name: openModal.g.name, nodeIds: openModal.g.nodeIds ?? [], description: openModal.g.description ?? "" }
              : undefined
          }
          allNodes={allNodes}
          onClose={() => setOpenModal(null)}
          onSubmit={(v) => {
            if (openModal.mode === "new") create.mutate(v);
            else update.mutate({ id: openModal.g.id, patch: v });
            setOpenModal(null);
          }}
        />
      )}
    </section>
  );
}
