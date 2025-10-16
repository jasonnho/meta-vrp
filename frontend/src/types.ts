export type NodeId = string;

export interface OptimizeRoute {
  vehicle_id: number;
  sequence: string[];
  total_time_min: number;
  load_profile_liters: number[];
}

export interface OptimizeResponse {
  objective_time_min: number;
  vehicle_used: number;
  routes: OptimizeRoute[];
  diagnostics?: Record<string, unknown>;
}

export type RouteStatus = "pending" | "in_progress" | "done" | "issue";

export interface LogEntry {
  id: string;
  time_iso: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  meta?: Record<string, unknown>;
}

export interface LogsPage {
    items: LogEntry[];
    next_cursor?: string | null;
}

export interface Operator {
  id: string;
  name: string;
  phone?: string;
}

export interface Vehicle {
  id: number;
  plate?: string;
  capacity_liters?: number;
}

export interface Assignment {
  id: string;
  routeVehicleId: number;
  operatorId: string;
  vehicleId: number;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  nodeIds: NodeId[];
  createdAt: string;
}

export interface Node {
  id: string;
  name?: string;
  lat: number;
  lon: number;
  // samakan dengan backend:
  kind?: "depot" | "refill" | "park";
}

// tambahkan di bawah tipe yang lain
export type JobStatus = "planned" | "running" | "succeeded" | "failed" | "cancelled" | string;

export interface HistoryItem {
  job_id: string;
  created_at: string;     // ISO string dengan timezone (e.g. +07:00)
  vehicle_count: number;  // jumlah kendaraan dipakai
  status: JobStatus;
  // opsional dari backend (kalau kamu tambahkan nanti):
  points_count?: number;        // alias utama yg kita pakai
  served_points?: number;       // alias yg mungkin dipakai backend
  points_total?: number;        // alias lain
  node_count?: number;          // alias lain
}

export interface JobVehicle {
  vehicle_id: number | string;
  plate?: string;
  operator?: { id?: string; name?: string };
}

export interface JobRoute {
  vehicle_id: number | string;
  sequence: string[];
  total_time_min?: number;
}

export interface JobDetail {
  job_id: string;
  created_at: string;
  status: JobStatus;
  vehicles: JobVehicle[];
  routes: JobRoute[];
}
