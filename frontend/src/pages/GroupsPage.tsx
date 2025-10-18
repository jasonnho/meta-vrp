import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Api } from "../lib/api";
import type { Group } from "../types";
import GroupFormModal from "../components/GroupFormModal";
import { useAllNodes } from "../hooks/useAllNodes";
import { useGroupsUI } from "../stores/groups";

export default function GroupsPage() {
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const { modal, openNew, openEdit, close } = useGroupsUI();

  // ==== Data Groups ====
  const { data: groups = [], isLoading, error, isFetching } = useQuery<Group[]>({
    queryKey: ["groups"],
    queryFn: Api.listGroups,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
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

  // ==== Sinkron modal <-> URL (?group=new | ?group=<id>) ====
  // Baca dari URL saat mount
  useEffect(() => {
    const g = sp.get("group");
    if (g === "new") {
      openNew();
    } else if (g) {
      openEdit(g);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tulis ke URL saat modal berubah
  useEffect(() => {
    const next = new URLSearchParams(sp);
    if (modal.mode === "new") {
      next.set("group", "new");
    } else if (modal.mode === "edit") {
      next.set("group", modal.id);
    } else {
      next.delete("group");
    }
    setSp(next, { replace: true });
  }, [modal, sp, setSp]);

  // Cari group yang sedang diedit (kalau ada)
  const editingGroup: Group | undefined = useMemo(() => {
    if (modal.mode !== "edit") return undefined;
    return groups.find((g) => String(g.id) === String(modal.id));
  }, [modal, groups]);

  // ==== Render ====
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Groups</h2>
        {isFetching && <span className="text-xs opacity-70">Syncing…</span>}
      </div>

      <div className="flex gap-2">
        <button
          className="px-3 py-2 rounded-lg bg-zinc-900 text-white"
          onClick={() => openNew()}
        >
          + New Group
        </button>
      </div>

      {isLoading ? (
        <div>Loading...</div>
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
                <button
                  className="px-2 py-1 rounded-md border text-xs"
                  onClick={() => openEdit(String(g.id))}
                >
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
            <div className="text-sm text-red-500">
              Failed to load groups: {(error as Error).message}
            </div>
          ) : (
            <>
              <div className="text-sm opacity-70 mb-3">Belum ada group.</div>
              <div className="flex justify-center gap-2">
                <button
                  className="px-3 py-2 rounded-lg bg-zinc-900 text-white"
                  onClick={() =>
                    create.mutate({ name: `Group ${Date.now() % 1000}`, nodeIds: [], description: null })
                  }
                >
                  + Quick Create
                </button>
                <button
                  className="px-3 py-2 rounded-lg border"
                  onClick={() => openNew()}
                >
                  + New Group (pilih titik)
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal (persist + URL-aware) */}
      {(modal.mode === "new" || modal.mode === "edit") && (
        <GroupFormModal
          open
          initial={
            modal.mode === "edit" && editingGroup
              ? {
                  name: editingGroup.name,
                  nodeIds: editingGroup.nodeIds ?? [],
                  description: editingGroup.description ?? "",
                }
              : undefined
          }
          allNodes={allNodes}
          onClose={() => {
            close();
            // URL akan dibersihkan oleh effect sinkron modal
          }}
          onSubmit={(v) => {
            if (modal.mode === "new") {
              create.mutate(v);
            } else if (modal.mode === "edit") {
              update.mutate({ id: editingGroup?.id ?? modal.id, patch: v });
            }
            close();
          }}
        />
      )}
    </section>
  );
}
