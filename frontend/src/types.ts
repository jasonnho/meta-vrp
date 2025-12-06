import type { Geometry } from 'geojson'
export type NodeId = string

export interface OptimizeRoute {
  vehicle_id: number
  sequence: string[]
  total_time_min: number
  load_profile_liters: number[]
}

export interface OptimizeResponse {
  objective_time_min: number
  vehicle_used: number
  routes: OptimizeRoute[]
  diagnostics?: Record<string, unknown>
}

export type RouteStatus = 'pending' | 'in_progress' | 'done' | 'issue'

export interface LogEntry {
  id: string
  time_iso: string
  level: 'INFO' | 'WARN' | 'ERROR'
  message: string
  meta?: Record<string, unknown>
}

export interface LogsPage {
  items: LogEntry[]
  next_cursor?: string | null
}

// --- Catalog ---
export type Operator = {
  id: string
  name: string
  phone?: string
  active: boolean
  createdAt: string // ISO
}

export type Vehicle = {
  id: string
  plate: string
  capacityL: number
  active: boolean
  createdAt: string // ISO
}

// --- Assignment (contoh kamu mungkin sudah punya) ---
export type Assignment = {
  id: string
  routeVehicleId: number
  operatorId: string
  vehicleId: string
  createdAt: string
}

export interface Group {
  id: string
  name: string
  description?: string | null
  nodeIds: NodeId[]
  createdAt: string
}

export interface Node {
  id: string
  name?: string
  lat: number
  lon: number
  kind?: 'depot' | 'refill' | 'park'
  demand?: number
  geometry?: Geometry | null // <-- TAMBAHKAN FIELD INI
}

// tambahkan di bawah tipe yang lain
export type JobStatus = 'planned' | 'running' | 'succeeded' | 'failed' | 'cancelled' | string

export interface HistoryItem {
  job_id: string
  created_at: string // ISO string dengan timezone (e.g. +07:00)
  vehicle_count: number // jumlah kendaraan dipakai
  status: JobStatus
  // opsional dari backend (kalau kamu tambahkan nanti):
  points_count?: number // alias utama yg kita pakai
  served_points?: number // alias yg mungkin dipakai backend
  points_total?: number // alias lain
  node_count?: number // alias lain
}

export interface JobRouteStep {
  sequence_index: number
  node_id: string
  status?: string | null
  reason?: string | null
}

export interface JobVehicle {
  vehicle_id: number | string
  plate?: string
  operator?: { id?: string; name?: string }
  status?: string
  route_total_time_min?: number
  assigned_vehicle_id?: string | number | null
  assigned_operator_id?: string | number | null

  // NEW: rute mentah per step dari /summary
  route?: JobRouteStep[]
}

export interface JobRoute {
  vehicle_id: number | string
  sequence: string[] // turunan dari vehicles[].route[].node_id
  total_time_min?: number
}

export interface JobDetail {
  job_id: string
  created_at: string
  status: JobStatus
  vehicles: JobVehicle[] // from /summary or /assignments
  routes: JobRoute[] // from /result (if available)
}
