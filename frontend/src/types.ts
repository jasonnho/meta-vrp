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
  id: string;         // contoh: "48" atau "25#1"
  name?: string;
  lat: number;
  lon: number;
  kind?: "depot" | "refill" | "customer";
}
