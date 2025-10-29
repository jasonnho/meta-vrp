# backend/migrations/fix_uuid.py
import os
from sqlalchemy import create_engine, text, inspect
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL not found in .env")

print(f"Connecting to: {DATABASE_URL}")

engine = create_engine(DATABASE_URL, echo=False)

try:
    with engine.connect() as conn:
        print("Fixing vrp_job_vehicle_runs.job_id → UUID...")
        conn.execute(text("""
            ALTER TABLE vrp_job_vehicle_runs
            ALTER COLUMN job_id TYPE UUID USING job_id::UUID;
        """))
        print("Done")

        print("Fixing vrp_job_step_status.job_id → UUID...")
        conn.execute(text("""
            ALTER TABLE vrp_job_step_status
            ALTER COLUMN job_id TYPE UUID USING job_id::UUID;
        """))
        print("Done")

        conn.commit()
        print("All UUID columns fixed!")

    # Verify
    inspector = inspect(engine)
    run_col = next(c for c in inspector.get_columns("vrp_job_vehicle_runs") if c["name"] == "job_id")
    step_col = next(c for c in inspector.get_columns("vrp_job_step_status") if c["name"] == "job_id")
    print(f"vrp_job_vehicle_runs.job_id → {run_col['type']}")
    print(f"vrp_job_step_status.job_id → {step_col['type']}")

except Exception as e:
    print(f"Error: {e}")
    print("Make sure:")
    print("  1. PostgreSQL is running (`brew services list`)")
    print("  2. User 'meta' and DB 'meta_vrp' exist")
    print("  3. .env has correct DATABASE_URL")
