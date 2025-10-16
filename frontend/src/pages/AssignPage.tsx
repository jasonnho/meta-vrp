import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Api } from "../lib/api";

export default function AssignPage() {
  const qc = useQueryClient();
  const { data: assignments } = useQuery({ queryKey: ["assignments"], queryFn: Api.listAssignments });

  const create = useMutation({
    mutationFn: Api.createAssignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments"] }),
  });

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Assign Operator + Vehicle</h2>

      <button
        className="px-3 py-2 rounded-lg bg-zinc-900 text-white"
        onClick={() =>
          create.mutate({ routeVehicleId: 0, operatorId: "op-1", vehicleId: 1 })
        }
      >
        + Quick Assign (demo)
      </button>

      <div className="text-sm">
        {(assignments ?? []).length === 0 ? "No assignments yet." : (
          <ul className="mt-2 space-y-2">
            {assignments!.map(a => (
              <li key={a.id} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-2">
                RV #{a.routeVehicleId} → Vehicle {a.vehicleId} • Operator {a.operatorId}
                <div className="text-xs opacity-70">{new Date(a.createdAt).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
