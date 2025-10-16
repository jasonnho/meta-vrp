import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Api } from "../lib/api";

export default function GroupsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["groups"], queryFn: Api.listGroups });
  const create = useMutation({
    mutationFn: Api.createGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Groups</h2>

      <div className="flex gap-2">
        <button
          className="px-3 py-2 rounded-lg bg-zinc-900 text-white"
          onClick={() => create.mutate({ name: `Group ${Date.now()%1000}`, nodeIds: [] })}
        >
          + New Group
        </button>
      </div>

      {isLoading ? "Loading..." : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {(data ?? []).map(g => (
            <li key={g.id} className="py-2 flex items-center justify-between">
              <div>
                <div className="font-medium">{g.name}</div>
                <div className="text-xs opacity-70">{g.nodeIds.length} points</div>
              </div>
              <div className="text-xs opacity-70">{new Date(g.createdAt).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
