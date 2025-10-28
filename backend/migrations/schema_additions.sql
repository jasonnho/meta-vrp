-- === 0.1 Park Groups (Grouping Taman) ===
CREATE TABLE IF NOT EXISTS park_groups (
  group_id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS park_group_items (
  group_id UUID REFERENCES park_groups(group_id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  PRIMARY KEY (group_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_park_group_items_group ON park_group_items(group_id);

-- === 0.2 Master Operators & Vehicles ===
CREATE TABLE IF NOT EXISTS operators (
  operator_id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id UUID PRIMARY KEY,
  plate TEXT UNIQUE,
  capacity_l NUMERIC,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === 0.3 Tambahan kolom assign & status di ringkasan per kendaraan ===
ALTER TABLE vrp_job_vehicle_runs
  ADD COLUMN IF NOT EXISTS assigned_vehicle_id UUID REFERENCES vehicles(vehicle_id),
  ADD COLUMN IF NOT EXISTS assigned_operator_id UUID REFERENCES operators(operator_id),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'planned';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vrp_job_vehicle_runs_status_chk'
  ) THEN
    ALTER TABLE vrp_job_vehicle_runs
      ADD CONSTRAINT vrp_job_vehicle_runs_status_chk
      CHECK (status IN ('planned','in_progress','done','cancelled'));
  END IF;
END$$;

-- === 0.4 Status Eksekusi per Step ===
CREATE TABLE IF NOT EXISTS vrp_job_step_status (
  job_id UUID NOT NULL,
  vehicle_id INT NOT NULL,
  sequence_index INT NOT NULL,
  status TEXT NOT NULL,              -- planned|visited|skipped|failed
  reason TEXT,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  author TEXT,
  PRIMARY KEY (job_id, vehicle_id, sequence_index)
);

CREATE INDEX IF NOT EXISTS idx_step_status_jobveh ON vrp_job_step_status(job_id, vehicle_id);

-- OPTIONAL: Tag/Notes (kalau mau dipakai di log/riwayat)
CREATE TABLE IF NOT EXISTS vrp_job_tags (
  job_id UUID NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (job_id, tag)
);

CREATE TABLE IF NOT EXISTS vrp_job_notes (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL,
  note TEXT NOT NULL,
  author TEXT,
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);
