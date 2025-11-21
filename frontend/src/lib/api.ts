import axios from "axios";
import type { Operator, Vehicle } from "../types";
import type { LogsPage } from "../types";
import type { HistoryItem } from "../types";
import type { JobDetail, JobVehicle, JobRoute, JobRouteStep } from "../types";
import type {
    OptimizeResponse,
    LogEntry,
    Group,
    Assignment,
    RouteStatus,
    Node,
} from "../types";
import { LOCAL_NODES } from "../data/nodes.data";
import type { Geometry } from "geojson";

const OSRM_BASE_URL = "https://router.project-osrm.org";

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE,
    timeout: 90000,
});

// contoh wrapper
export async function getJSON<T>(url: string, params?: any): Promise<T> {
    const { data } = await api.get<T>(url, { params });
    return data;
}
export async function postJSON<T>(url: string, body?: any): Promise<T> {
    const { data } = await api.post<T>(url, body);
    return data;
}

export const Api = {
    // ... (semua fungsi Anda yang lain seperti optimize, listGroups, dll...)
    // ... (optimize, listLogs, listGroups, createGroup, updateGroup, deleteGroup) ...

    optimize: (payload: any) =>
        postJSON<OptimizeResponse>("/optimize", payload),
    listLogs: () => getJSON<LogEntry[]>("/logs"),
    listGroups: async (): Promise<Group[]> => {
        const raw = await getJSON<any[]>("/groups");
        return (raw ?? []).map((g) => ({
            id: String(g.id ?? g.group_id ?? ""),
            name: String(g.name ?? ""),
            description: g.description ?? g.desc ?? null,
            nodeIds: Array.isArray(g.nodeIds) ? g.nodeIds : g.node_ids ?? [],
            createdAt: String(
                g.createdAt ?? g.created_at ?? new Date().toISOString()
            ),
        }));
    },
    createGroup: (g: Pick<Group, "name" | "nodeIds" | "description">) =>
        api
            .post<Group>("/groups", {
                name: g.name,
                description: g.description ?? null,
                node_ids: g.nodeIds,
            })
            .then((r) => r.data),
    updateGroup: (
        id: string,
        patch: Partial<Pick<Group, "name" | "nodeIds" | "description">>
    ) => {
        const body: any = {};
        if (typeof patch.name === "string") body.name = patch.name;
        if (
            typeof patch.description === "string" ||
            patch.description === null
        ) {
            body.description = patch.description;
        }
        if (Array.isArray(patch.nodeIds)) body.node_ids = patch.nodeIds;
        return api.patch<Group>(`/groups/${id}`, body).then((r) => r.data);
    },
    deleteGroup: (id: string) => api.delete(`/groups/${id}`).then(() => true),

    // Fungsi listNodes (dari sebelumnya, sudah benar)
    listNodes: async (): Promise<Node[]> => {
        console.log(
            "✅ [API INTERCEPT] Mengembalikan data dari 'nodes.data.ts' (bukan backend)"
        );
        await new Promise((res) => setTimeout(res, 50));
        return LOCAL_NODES;
    },

    // ==========================================================
    // 👇 PERBAIKAN ADA DI SINI 👇
    // ==========================================================

    getRouteGeometry: async (
        lon1: number,
        lat1: number,
        lon2: number,
        lat2: number
    ): Promise<Geometry> => {
        // PERBAIKAN: Format OSRM adalah {longitude},{latitude}
        // Saya sebelumnya salah mengetik urutannya.
        // Sekarang sudah benar: lon1,lat1;lon2,lat2
        const coordinates = `${lon1},${lat1};${lon2},${lat2}`;

        const url = `${OSRM_BASE_URL}/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;

        try {
            const response = await axios.get(url);
            const geometry = response.data?.routes?.[0]?.geometry;
            if (geometry) {
                return geometry as Geometry; // Ini adalah rute jalan raya (sukses)
            } else {
                throw new Error("Tidak ada rute ditemukan oleh OSRM");
            }
        } catch (error) {
            console.error(
                "Gagal mengambil rute OSRM (menggunakan fallback garis lurus):",
                error
            );
            // Fallback: jika gagal, gambar garis lurus [lon, lat] (format GeoJSON)
            return {
                type: "LineString",
                coordinates: [
                    [lon1, lat1],
                    [lon2, lat2],
                ],
            };
        }
    },

    // ==========================================================
    // 👆 PERBAIKAN SELESAI 👆
    // ==========================================================

    // ... (Sisa fungsi Anda: listAssignments, listHistory, getJobDetail, dll.)
    // ...
    listAssignments: () => getJSON<Assignment[]>("/assignments"),
    createAssignment: (a: Omit<Assignment, "id" | "createdAt">) =>
        postJSON<Assignment>("/assignments", a),
    updateRouteStatus: (routeVehicleId: number, status: RouteStatus) =>
        postJSON<{ ok: boolean }>(`/routes/${routeVehicleId}/status`, {
            status,
        }),
    listLogsPaged: async (
        params: { limit?: number; cursor?: string | null } = {}
    ): Promise<LogsPage> => {
        const data = await getJSON<any>("/jobs", params);
        if (data && Array.isArray(data.items)) {
            return data as LogsPage;
        }
        if (Array.isArray(data)) {
            return { items: data as any[], next_cursor: null };
        }
        return { items: [], next_cursor: null };
    },
    listHistory: async (): Promise<HistoryItem[]> => {
        const raw = await getJSON<any>("/jobs");
        if (Array.isArray(raw)) {
            return raw.map((r) => ({
                job_id: String(r.job_id ?? r.id ?? ""),
                created_at: String(
                    r.created_at ?? r.time_iso ?? r.timestamp ?? ""
                ),
                vehicle_count: Number(
                    r.vehicle_count ?? r.vehicles ?? r.vehicle_used ?? 0
                ),
                status: String(r.status ?? r.level ?? "planned"),
                points_count:
                    r.points_count ??
                    r.served_points ??
                    r.points_total ??
                    r.node_count ??
                    undefined,
            })) as HistoryItem[];
        }
        return [];
    },
    getJobDetail: async (job_id: string): Promise<JobDetail> => {
        const summary = await api
            .get<any>(`/jobs/${job_id}/summary`)
            .then((r) => r.data);
        const jobId = String(summary.job?.job_id ?? job_id);
        const created = String(summary.job?.created_at ?? "");
        const status = String(summary.job?.status ?? "planned");
        let vehicles: JobVehicle[] = [];
        if (Array.isArray(summary.vehicles)) {
            vehicles = summary.vehicles.map((v: any) => ({
                vehicle_id: v.vehicle_id ?? v.id,
                plate: v.plate ?? v.license_plate ?? v.nopol ?? undefined,
                operator: v.operator
                    ? {
                          id: v.operator.id ?? v.assigned_operator_id,
                          name: v.operator.name,
                      }
                    : undefined,
                status: v.status,
                route_total_time_min: v.route_total_time_min,
                assigned_vehicle_id: v.assigned_vehicle_id ?? null,
                assigned_operator_id: v.assigned_operator_id ?? null,
                route: Array.isArray(v.route)
                    ? (v.route as JobRouteStep[])
                    : undefined,
            }));
        }
        const routes: JobRoute[] = vehicles
            .filter((v) => Array.isArray(v.route) && v.route.length > 0)
            .map((v) => ({
                vehicle_id: v.vehicle_id,
                sequence: (v.route as JobRouteStep[])
                    .sort((a, b) => a.sequence_index - b.sequence_index)
                    .map((step) => step.node_id),
                total_time_min: v.route_total_time_min,
            }));
        return { job_id: jobId, created_at: created, status, vehicles, routes };
    },
    listOperators: async (): Promise<Operator[]> => {
        const raw = await getJSON<any[]>("/catalog/operators");
        return (raw ?? []).map((o) => ({
            id: String(o.operator_id ?? o.id ?? ""),
            name: String(o.name ?? ""),
            phone: o.phone ? String(o.phone) : undefined,
            active: Boolean(o.active ?? true),
            createdAt: String(
                o.created_at ?? o.createdAt ?? new Date().toISOString()
            ),
        }));
    },
    createOperator: (
        op: Pick<Operator, "name" | "phone" | "active">
    ): Promise<Operator> =>
        api
            .post("/catalog/operators", {
                name: op.name,
                phone: op.phone ?? null,
                active: op.active ?? true,
            })
            .then((r) => {
                const o = r.data;
                return {
                    id: String(o.operator_id ?? o.id ?? ""),
                    name: String(o.name ?? ""),
                    phone: o.phone ? String(o.phone) : undefined,
                    active: Boolean(o.active ?? true),
                    createdAt: String(
                        o.created_at ?? o.createdAt ?? new Date().toISOString()
                    ),
                } as Operator;
            }),
    updateOperator: (
        id: string,
        patch: Partial<Pick<Operator, "name" | "phone" | "active">>
    ): Promise<Operator> => {
        const body: any = {};
        if (typeof patch.name === "string") body.name = patch.name;
        if (typeof patch.phone === "string" || patch.phone === null)
            body.phone = patch.phone ?? null;
        if (typeof patch.active === "boolean") body.active = patch.active;
        return api.patch(`/catalog/operators/${id}`, body).then((r) => {
            const o = r.data;
            return {
                id: String(o.operator_id ?? o.id ?? ""),
                name: String(o.name ?? ""),
                phone: o.phone ? String(o.phone) : undefined,
                active: Boolean(o.active ?? true),
                createdAt: String(
                    o.created_at ?? o.createdAt ?? new Date().toISOString()
                ),
            } as Operator;
        });
    },
    deleteOperator: (id: string): Promise<true> =>
        api.delete(`/catalog/operators/${id}`).then(() => true),
    listVehicles: async (): Promise<Vehicle[]> => {
        const raw = await getJSON<any[]>("/catalog/vehicles");
        return (raw ?? []).map((v) => ({
            id: String(v.vehicle_id ?? v.id ?? ""),
            plate: String(v.plate ?? ""),
            capacityL: Number(v.capacity_l ?? v.capacityL ?? 0),
            active: Boolean(v.active ?? true),
            createdAt: String(
                v.created_at ?? v.createdAt ?? new Date().toISOString()
            ),
        }));
    },
    createVehicle: (
        v: Pick<Vehicle, "plate" | "capacityL" | "active">
    ): Promise<Vehicle> =>
        api
            .post("/catalog/vehicles", {
                plate: v.plate,
                capacity_l: v.capacityL,
                active: v.active ?? true,
            })
            .then((r) => {
                const x = r.data;
                return {
                    id: String(x.vehicle_id ?? x.id ?? ""),
                    plate: String(x.plate ?? ""),
                    capacityL: Number(x.capacity_l ?? x.capacityL ?? 0),
                    active: Boolean(x.active ?? true),
                    createdAt: String(
                        x.created_at ?? x.createdAt ?? new Date().toISOString()
                    ),
                } as Vehicle;
            }),
    updateVehicle: (
        id: string,
        patch: Partial<Pick<Vehicle, "plate" | "capacityL" | "active">>
    ): Promise<Vehicle> => {
        const body: any = {};
        if (typeof patch.plate === "string") body.plate = patch.plate;
        if (typeof patch.capacityL === "number")
            body.capacity_l = patch.capacityL;
        if (typeof patch.active === "boolean") body.active = patch.active;
        return api.patch(`/catalog/vehicles/${id}`, body).then((r) => {
            const x = r.data;
            return {
                id: String(x.vehicle_id ?? x.id ?? ""),
                plate: String(x.plate ?? ""),
                capacityL: Number(x.capacity_l ?? x.capacityL ?? 0),
                active: Boolean(x.active ?? true),
                createdAt: String(
                    x.created_at ?? x.createdAt ?? new Date().toISOString()
                ),
            } as Vehicle;
        });
    },
    deleteVehicle: (id: string): Promise<true> =>
        api.delete(`/catalog/vehicles/${id}`).then(() => true),
    assignJobVehicle: (
        jobId: string,
        vid: string | number,
        payload: {
            assigned_vehicle_id?: string | null;
            assigned_operator_id?: string | null;
            status?: string | null;
        }
    ): Promise<{ ok: boolean } | any> => {
        const body: any = {};
        if (payload.assigned_vehicle_id !== undefined)
            body.assigned_vehicle_id = payload.assigned_vehicle_id;
        if (payload.assigned_operator_id !== undefined)
            body.assigned_operator_id = payload.assigned_operator_id;
        if (payload.status !== undefined) body.status = payload.status;
        return api
            .patch(
                `/jobs/${encodeURIComponent(
                    jobId
                )}/vehicles/${encodeURIComponent(String(vid))}`,
                body
            )
            .then((r) => r.data);
    },
    updateJobVehicleStatus: (
        jobId: string,
        vid: string | number,
        status: string
    ) =>
        api
            .patch(
                `/jobs/${encodeURIComponent(
                    jobId
                )}/vehicles/${encodeURIComponent(String(vid))}`,
                {
                    status,
                }
            )
            .then((r) => r.data),
    updateJobVehicleStepStatus: (
        jobId: string,
        vid: string | number,
        seq: number | string,
        payload: { status: string; reason?: string }
    ) =>
        api
            .patch(
                `/jobs/${encodeURIComponent(
                    jobId
                )}/vehicles/${encodeURIComponent(
                    String(vid)
                )}/steps/${encodeURIComponent(String(seq))}`,
                {
                    status: payload.status,
                    ...(payload.reason ? { reason: payload.reason } : {}),
                }
            )
            .then((r) => r.data),
};
