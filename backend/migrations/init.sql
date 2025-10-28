-- Create the missing table first
CREATE TABLE IF NOT EXISTS vrp_job_vehicle_runs (
    job_id UUID NOT NULL,
    vehicle_id INT NOT NULL,
    PRIMARY KEY (job_id, vehicle_id)
);
