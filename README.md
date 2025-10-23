# 🚛 Meta-VRP — Developer Quickstart Guide

---

## 🧩 0. Clone Repository

```bash
git clone https://github.com/jasonnho/meta-vrp.git
cd meta-vrp
````

> Struktur direktori yang diharapkan:
>
> ```
> meta-vrp/
> ├─ backend/
> └─ frontend/
> ```

---

## 🗃️ 1. Setup Database (pilih salah satu)

### 🐳 Opsi A — PostgreSQL via Docker (Direkomendasikan)

```bash
# Jalankan PostgreSQL 16 di port 5432
docker run --name meta-vrp-pg \
  -e POSTGRES_DB=meta_vrp \
  -e POSTGRES_USER=meta \
  -e POSTGRES_PASSWORD=dev \
  -p 5432:5432 \
  -v meta_vrp_pgdata:/var/lib/postgresql/data \
  -d postgres:16
```

**Jalankan migrasi SQL (`backend/migrations/schema_additions.sql`)**

**Cara 1 — copy file ke container lalu eksekusi**

```bash
# dari root repo
docker cp backend/migrations/schema_additions.sql meta-vrp-pg:/schema_additions.sql

docker exec -it meta-vrp-pg psql \
  -U meta -d meta_vrp -f /schema_additions.sql
# Password: dev
```

**Cara 2 — one-off container untuk `psql` (tanpa copy)**

```bash
# macOS / Linux:
docker run --rm -i --network host \
  -v "$(pwd)/backend/migrations:/migrations" postgres:16 \
  psql -h localhost -U meta -d meta_vrp -f /migrations/schema_additions.sql

# Windows PowerShell:
docker run --rm -i --network host `
  -v "${PWD}\backend\migrations:/migrations" postgres:16 `
  psql -h localhost -U meta -d meta_vrp -f /migrations/schema_additions.sql
# Password: dev
```

---

### 🖥️ Opsi B — PostgreSQL Native (tanpa Docker)

1. Install PostgreSQL (v14–v16 OK).
2. Buat user & database:

```sql
CREATE USER meta WITH PASSWORD 'dev';
CREATE DATABASE meta_vrp OWNER meta;
GRANT ALL PRIVILEGES ON DATABASE meta_vrp TO meta;
```

3. Jalankan migrasi:

```bash
psql "postgresql://meta:dev@localhost:5432/meta_vrp" -f backend/migrations/schema_additions.sql
```

> 💡 **Tips:** gunakan `IF NOT EXISTS` di SQL agar migrasi bisa dijalankan berulang dengan aman.

---

## ⚙️ 2. Setup Backend (FastAPI)

### 2.1 Buat virtual environment & install dependencies

```bash
cd backend

# Buat virtual environment
python -m venv .venv

# Aktifkan environment
# Windows PowerShell:
. .venv/Scripts/Activate.ps1
# macOS / Linux:
# source .venv/bin/activate

# Install dependency
pip install -r requirements.txt
# atau minimal:
# pip install fastapi uvicorn[standard] sqlalchemy psycopg[binary] python-dotenv pydantic
```

### 2.2 Buat file konfigurasi environment

Buat file `.env` di folder `backend/`:

```env
DATABASE_URL=postgresql+psycopg://meta:dev@localhost:5432/meta_vrp
# Jika memakai psycopg2-binary:
# DATABASE_URL=postgresql+psycopg2://meta:dev@localhost:5432/meta_vrp

CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

### 2.3 Jalankan backend

```bash
uvicorn backend.app:app --reload --port 8000
```

Backend sekarang aktif di: [http://localhost:8000](http://localhost:8000)

---

## 💻 3. Setup Frontend (React + Vite + TypeScript)

### 3.1 Install dependencies

```bash
cd ../frontend
npm install
```

### 3.2 Buat file `.env`

Buat file `.env` di folder `frontend/`:

```env
VITE_API_BASE=http://localhost:8000
```

### 3.3 Jalankan dev server

```bash
npm run dev
# buka http://localhost:5173
```

---

## 🧠 4. Troubleshooting

| Masalah                          | Penyebab                                           | Solusi                                                                             |
| -------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `psql: command not found`        | Postgres CLI belum terinstal                       | Jalankan migrasi pakai Docker one-off container (lihat Opsi A Cara 2)              |
| Backend gagal konek DB           | `DATABASE_URL` salah                               | Pastikan host `localhost` & port `5432`                                            |
| CORS error di browser            | Origin frontend belum diizinkan                    | Tambahkan `http://localhost:5173` di `CORS_ORIGINS`                                |
| `Cannot find module '@/lib/...'` | Folder `frontend/src/lib` hilang / belum di-commit | Pastikan sudah di-commit dan alias di `tsconfig.json` benar:                       |
|                                  |                                                    | `json<br>{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } } }` |

---

## 🐋 5. (Opsional) Jalankan Semua Sekaligus via Docker Compose

Buat file `docker-compose.yml` di root project:

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

**Build & Run semua service:**

```bash
docker compose up --build
```

---

## ⚡ 6. Cheat Sheet (Semua Perintah Cepat)

```bash
# Clone repo
git clone https://github.com/jasonnho/meta-vrp.git
cd meta-vrp

# Jalankan PostgreSQL (Docker)
docker run --name meta-vrp-pg \
  -e POSTGRES_DB=meta_vrp \
  -e POSTGRES_USER=meta \
  -e POSTGRES_PASSWORD=dev \
  -p 5432:5432 \
  -v meta_vrp_pgdata:/var/lib/postgresql/data \
  -d postgres:16

# Apply migrasi
docker cp backend/migrations/schema_additions.sql meta-vrp-pg:/schema_additions.sql
docker exec -it meta-vrp-pg psql -U meta -d meta_vrp -f /schema_additions.sql

# Backend setup
cd backend
python -m venv .venv
. .venv/Scripts/Activate.ps1   # (Windows) | source .venv/bin/activate (macOS/Linux)
pip install -r requirements.txt
echo "DATABASE_URL=postgresql+psycopg://meta:dev@localhost:5432/meta_vrp" > .env
echo "CORS_ORIGINS=http://localhost:5173" >> .env
uvicorn backend.app:app --reload --port 8000

# Frontend setup
cd ../frontend
npm install
echo "VITE_API_BASE=http://localhost:8000" > .env
npm run dev
```

---

```
```
