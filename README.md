Tentu, ini adalah kode Markdown lengkap berdasarkan teks yang kamu berikan. Kamu bisa salin-tempel (copy-paste) seluruh isi blok kode di bawah ini langsung ke file `README.md` kamu.

````markdown
# Meta-VRP — Dev Quickstart

Repo: https://github.com/jasonnho/meta-vrp.git

Panduan ini memandu kolaborator dari **clone → setup → run**, baik dengan PostgreSQL via **Docker** maupun **native install**. Sertakan juga pengecualian `.gitignore` agar **hanya** `frontend/src/lib` yang ikut di-commit.

---

## 0) Clone Repository

```bash
git clone [https://github.com/jasonnho/meta-vrp.git](https://github.com/jasonnho/meta-vrp.git)
cd meta-vrp
````

Struktur direktori yang diharapkan:

```
meta-vrp/
├─ backend/
└─ frontend/
```

## 1\) Setup Database (pilih salah satu)

### Opsi A — PostgreSQL via Docker (Direkomendasikan)

```bash
# Jalankan Postgres 16 di port 5432
docker run --name meta-vrp-pg \
  -e POSTGRES_DB=meta_vrp \
  -e POSTGRES_USER=meta \
  -e POSTGRES_PASSWORD=dev \
  -p 5432:5432 \
  -v meta_vrp_pgdata:/var/lib/postgresql/data \
  -d postgres:16
```

Apply migrasi SQL (`backend/migrations/schema_additions.sql`)

**Cara 1 — copy file ke container lalu eksekusi**

```bash
# dari root repo
docker cp backend/migrations/schema_additions.sql meta-vrp-pg:/schema_additions.sql

docker exec -it meta-vrp-pg psql \
  -U meta -d meta_vrp -f /schema_additions.sql
# Password: dev
```

**Cara 2 — one-off container untuk psql (tanpa copy)**

```bash
# macOS/Linux:
docker run --rm -i --network host \
  -v "$(pwd)/backend/migrations:/migrations" postgres:16 \
  psql -h localhost -U meta -d meta_vrp -f /migrations/schema_additions.sql

# Windows PowerShell:
docker run --rm -i --network host `
  -v "${PWD}\backend\migrations:/migrations" postgres:16 `
  psql -h localhost -U meta -d meta_vrp -f /migrations/schema_additions.sql
# Password: dev
```

### Opsi B — PostgreSQL Native (tanpa Docker)

1.  Install PostgreSQL (v14–16 OK).
2.  Buat user & database:
    ```sql
    -- jalankan di psql
    CREATE USER meta WITH PASSWORD 'dev';
    CREATE DATABASE meta_vrp OWNER meta;
    GRANT ALL PRIVILEGES ON DATABASE meta_vrp TO meta;
    ```
3.  Apply migrasi:
    ```bash
    psql "postgresql://meta:dev@localhost:5432/meta_vrp" -f backend/migrations/schema_additions.sql
    ```

*Saran: Buat migrasi idempotent (pakai `IF NOT EXISTS`) agar aman jika dijalankan berulang.*

## 2\) Backend (FastAPI)

### 2.1 Buat virtual env & install dependencies

```bash
cd backend

# Python venv
python -m venv .venv

# Activate venv
# Windows PowerShell:
. .venv/Scripts/Activate.ps1
# macOS/Linux:
# source .venv/bin/activate

# Install packages
pip install -r requirements.txt
# (alternatif minimum)
# pip install fastapi uvicorn[standard] sqlalchemy psycopg[binary] python-dotenv pydantic
```

### 2.2 Konfigurasi environment

Buat file `backend/.env`:

```.env
# Driver psycopg3:
DATABASE_URL=postgresql+psycopg://meta:dev@localhost:5432/meta_vrp
# Jika memakai psycopg2-binary:
# DATABASE_URL=postgresql+psycopg2://meta:dev@localhost:5432/meta_vrp

# Sesuaikan dengan port frontend
CORS_ORIGINS=http://localhost:5173,[http://127.0.0.1:5173](http://127.0.0.1:5173)
```

### 2.3 Jalankan server

```bash
# Dari folder backend, dengan venv aktif:
uvicorn backend.app:app --reload --port 8000
# Ganti "backend.app:app" jika entrypoint berbeda
```

Backend siap di: `http://localhost:8000`

## 3\) Frontend (Vite + React + TypeScript)

### 3.1 Install dependencies

```bash
cd ../frontend
npm install
```

### 3.2 Konfigurasi environment

Buat file `frontend/.env`:

```.env
# URL backend FastAPI
VITE_API_BASE=http://localhost:8000
```

### 3.3 Jalankan dev server

```bash
npm run dev
# buka http://localhost:5173
```

## 4\) Penting: Commit HANYA frontend/src/lib (bukan backend/.venv/lib)

Jika `.gitignore` saat ini meng-ignore semua `lib`, tambahkan pengecualian agar hanya `frontend/src/lib` yang ikut di-commit.

Tambahkan di paling bawah `.gitignore` (root repo):

```.gitignore
# Izinkan hanya lib di frontend/src
!frontend/src/lib/
!frontend/src/lib/**
```

Lalu force-add saat pertama kali:

```bash
git add -f frontend/src/lib
git commit -m "chore: include frontend/src/lib in repo"
```

**Alasan:**

  * `frontend/src/lib` = kode sumber (helper/api/utils) → wajib di-commit.
  * `backend/.venv/lib` = library virtualenv → jangan di-commit (auto-generated & besar).

## 5\) Troubleshooting

  * **`psql: command not found`**
    Pakai Opsi A Cara 2 (one-off Docker psql) untuk menjalankan migrasi tanpa install Postgres client.
  * **Backend gagal konek DB**
    Cek `DATABASE_URL` di `backend/.env`. Untuk Docker single container + port mapping, hostnya `localhost`.
  * **CORS error di browser**
    Pastikan `CORS_ORIGINS` di `backend/.env` memuat origin frontend (mis. `http://localhost:5173`).
  * **Frontend error `Cannot find module '@/lib/...'`**
    Pastikan `frontend/src/lib` ada dan ter-commit. Cek juga alias `tsconfig.json`:
    ```json
    {
      "compilerOptions": {
        "baseUrl": ".",
        "paths": { "@/*": ["src/*"] }
      }
    }
    ```

## 6\) (Opsional) Jalankan Semuanya via Docker Compose

Buat `docker-compose.yml` di root (kalau belum ada):

```yaml
version: "3.9"
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: meta_vrp
      POSTGRES_USER: meta
      POSTGRES_PASSWORD: dev
    ports:
      - "5432:5432"
    volumes:
      - meta_vrp_pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql+psycopg://meta:dev@db:5432/meta_vrp
      CORS_ORIGINS: http://localhost:5173
    depends_on:
      - db
    ports:
      - "8000:8000"
    command: uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
    volumes:
      - ./backend:/app

  frontend:
    build: ./frontend
    environment:
      VITE_API_BASE: http://localhost:8000
    depends_on:
      - backend
    ports:
      - "5173:5173"
    command: npm run dev -- --host 0.0.0.0
    volumes:
      - ./frontend:/app

volumes:
  meta_vrp_pgdata:
```

Build & Run:

```bash
docker compose up --build
```

## 7\) Cheat-Sheet Perintah Cepat

```bash
# Clone
git clone [https://github.com/jasonnho/meta-vrp.git](https://github.com/jasonnho/meta-vrp.git)
cd meta-vrp

# Postgres via Docker
docker run --name meta-vrp-pg -e POSTGRES_DB=meta_vrp -e POSTGRES_USER=meta -e POSTGRES_PASSWORD=dev -p 5432:5432 -v meta_vrp_pgdata:/var/lib/postgresql/data -d postgres:16
docker cp backend/migrations/schema_additions.sql meta-vrp-pg:/schema_additions.sql
docker exec -it meta-vrp-pg psql -U meta -d meta_vrp -f /schema_additions.sql

# Backend
cd backend
python -m venv .venv
. .venv/Scripts/Activate.ps1   # (Windows) | source .venv/bin/activate (macOS/Linux)
pip install -r requirements.txt
printf "DATABASE_URL=postgresql+psycopg://meta:dev@localhost:5432/meta_vrp\nCORS_ORIGINS=http://localhost:5173" > .env
uvicorn backend.app:app --reload --port 8000

# Frontend (terminal baru)
cd ../frontend
npm install
printf "VITE_API_BASE=http://localhost:8000" > .env
npm run dev
```

```
```
