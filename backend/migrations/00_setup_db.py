# backend/migrations/00_setup_db.py
import os
import psycopg
from dotenv import load_dotenv

load_dotenv()

# Connect to default 'postgres' DB (no password, uses your macOS user)
DEFAULT_URL = "postgresql://localhost:5432/postgres"

print("Setting up user 'meta' and database 'meta_vrp'...")

with psycopg.connect(DEFAULT_URL) as conn:
    conn.autocommit = True

    with conn.cursor() as cur:
        # Create user
        cur.execute("SELECT 1 FROM pg_roles WHERE rolname = 'meta'")
        if not cur.fetchone():
            print("Creating user 'meta'...")
            cur.execute("CREATE USER meta WITH PASSWORD 'dev'")
        else:
            print("User 'meta' already exists")

        # Create database
        cur.execute("SELECT 1 FROM pg_database WHERE datname = 'meta_vrp'")
        if not cur.fetchone():
            print("Creating database 'meta_vrp'...")
            cur.execute("CREATE DATABASE meta_vrp OWNER meta")
        else:
            print("Database 'meta_vrp' already exists")

        # Grant privileges
        cur.execute("GRANT ALL PRIVILEGES ON DATABASE meta_vrp TO meta")

    print("Setup complete!")
