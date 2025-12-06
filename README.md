# 🚛 Armada Hijau: Website Optimasi Rute Mobil Penyiram Taman

[![CI Status](https://github.com/jasonnho/meta-vrp/actions/workflows/ci_quality.yml/badge.svg)](https://github.com/jasonnho/meta-vrp/actions/workflows/ci_quality.yml)
![Python](https://img.shields.io/badge/Python-3.10+-blue)
![React](https://img.shields.io/badge/React-18-cyan)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)

**Meta-VRP** adalah aplikasi *Capstone Project* yang dirancang untuk mengoptimalkan rute penyiraman taman kota menggunakan algoritma **Adaptive Large Neighborhood Search (ALNS)**. Sistem ini membantu meminimalkan jarak tempuh armada, menyeimbangkan beban kerja, dan mengelola kebutuhan air (demand) secara efisien dengan data real-world routing.

---

## ✨ Fitur Utama

### 🧠 Algoritma Cerdas (Backend)
* **Engine ALNS:** Menggunakan heuristik *destroy* dan *repair* adaptif untuk mencari solusi rute mendekati optimal
* **Multi-Constraint:** Memperhitungkan kapasitas tangki air, jendela waktu (opsional), dan lokasi pengisian ulang (*refill stations*)
* **Real-World Distance:** Integrasi dengan **OSRM (Open Source Routing Machine)** untuk kalkulasi jarak dan waktu tempuh nyata (bukan Euclidean)
* **Adaptive Learning:** Bobot operator destroy/repair menyesuaikan berdasarkan performa historis

### 🖥️ Antarmuka Modern (Frontend)
* **Peta Interaktif:** Visualisasi rute menggunakan **React Leaflet** dengan ikon kustom (Pohon, Rumah, Droplet)
* **Indikator Demand:** Visualisasi warna taman (Hijau/Kuning/Merah) berdasarkan volume kebutuhan air
* **Route Highlight:** Fitur isolasi rute per kendaraan untuk analisis mendalam
* **Laporan PDF Generatif:** Ekspor laporan profesional otomatis yang memisahkan detail rute per halaman
* **Real-time Optimization:** Progress tracking selama proses optimasi berjalan

---

## 🛠️ Tech Stack

**Frontend:**
* **Framework:** React 18 + Vite (TypeScript 5.0)
* **Styling:** Tailwind CSS + Shadcn/UI
* **State Management:** Zustand + TanStack Query
* **Maps:** React Leaflet + OSRM API
* **Visuals:** Framer Motion, Lucide React
* **PDF Generation:** jsPDF

**Backend:**
* **Framework:** FastAPI (Python 3.10+)
* **Computation:** NumPy, Pandas
* **Database:** PostgreSQL (Production) / SQLite (Development)
* **ORM:** SQLAlchemy + Psycopg (v3)
* **Routing API:** OSRM Integration

**DevOps & Quality Assurance:**
* **CI/CD:** GitHub Actions
* **Linter/Formatter:** Ruff, Black (Backend) | ESLint, Prettier (Frontend)
* **Hooks:** Pre-commit hooks untuk code quality
* **Containerization:** Docker & Docker Compose ready

---

## 🚀 Panduan Instalasi (Local Development)

### Prasyarat
* **Node.js** v18+
* **Python** v3.10+
* **PostgreSQL** v14+ (atau Docker)
* **Git**

### 📦 Quick Start

```bash
# 1. Clone repository
git clone https://github.com/jasonnho/meta-vrp.git
cd meta-vrp

# 2. Setup database (pilih salah satu metode di bawah)
# 3. Setup backend
# 4. Setup frontend
```

---

## 🗃️ Setup Database (Pilih Salah Satu)

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

**Jalankan Migrasi Database:**

**Cara 1 — Copy file ke container lalu eksekusi**

```bash
# Dari root repository
docker cp backend/migrations/schema_additions.sql meta-vrp-pg:/schema_additions.sql

docker exec -it meta-vrp-pg psql \
  -U meta -d meta_vrp -f /schema_additions.sql
# Password: dev
```

**Cara 2 — One-off container (tanpa copy)**

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

1. **Install PostgreSQL** (v14–v16)
2. **Buat user & database:**

```sql
CREATE USER meta WITH PASSWORD 'dev';
CREATE DATABASE meta_vrp OWNER meta;
GRANT ALL PRIVILEGES ON DATABASE meta_vrp TO meta;
```

3. **Jalankan migrasi:**

```bash
psql "postgresql://meta:dev@localhost:5432/meta_vrp" \
  -f backend/migrations/schema_additions.sql
```

> 💡 **Tips:** SQL migration menggunakan `IF NOT EXISTS` sehingga aman dijalankan berulang kali.

---

## ⚙️ Setup Backend (FastAPI)

### 1. Buat Virtual Environment & Install Dependencies

```bash
cd backend

# Buat virtual environment
python -m venv .venv

# Aktifkan environment
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# macOS / Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

> **Catatan:** Dependencies minimal yang diperlukan:
> - `fastapi`, `uvicorn[standard]`
> - `sqlalchemy`, `psycopg[binary]`
> - `python-dotenv`, `pydantic`
> - `numpy`, `pandas`

### 2. Konfigurasi Environment Variables

Buat file `.env` di folder `backend/`:

```env
# Database Connection
DATABASE_URL=postgresql+psycopg://meta:dev@localhost:5432/meta_vrp

# Jika menggunakan psycopg2-binary:
# DATABASE_URL=postgresql+psycopg2://meta:dev@localhost:5432/meta_vrp

# CORS Settings
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Optional: OSRM Server
# OSRM_SERVER=http://router.project-osrm.org
```

### 3. Jalankan Backend Server

```bash
uvicorn backend.app:app --reload --port 8000
```

✅ **Backend sekarang aktif di:** [http://localhost:8000](http://localhost:8000)
📚 **API Documentation (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 💻 Setup Frontend (React + Vite + TypeScript)

### 1. Install Dependencies

```bash
cd ../frontend
npm install
```

### 2. Konfigurasi Environment Variables

Buat file `.env` di folder `frontend/`:

```env
VITE_API_BASE=http://localhost:8000
```

### 3. Jalankan Development Server

```bash
npm run dev
```

✅ **Frontend sekarang aktif di:** [http://localhost:5173](http://localhost:5173)

---

## 🛡️ Quality Assurance & Testing

Proyek ini menerapkan standar kualitas kode yang ketat dengan automated checks.

### Setup Pre-commit Hooks (Wajib untuk Kontributor)

Kembali ke **root folder** proyek:

```bash
pip install pre-commit
pre-commit install
```

*Ini akan memastikan kode Anda otomatis dicek setiap kali melakukan commit.*

### Menjalankan Pengecekan Manual

**Frontend (Linting & Formatting):**

```bash
cd frontend
npm run lint      # Cek logic error dengan ESLint
npm run format    # Perbaiki format otomatis (Prettier)
```

**Backend (Linting & Formatting):**

```bash
cd backend
black .           # Format kode otomatis
ruff check .      # Cek logic error & code quality
```

**Cek Seluruh Proyek (Pre-commit):**

```bash
# Dari root folder
pre-commit run --all-files
```

---

## 🐋 Docker Compose (Jalankan Semua Sekaligus)

Untuk menjalankan seluruh stack (Database + Backend + Frontend) dengan satu perintah:

### 1. Pastikan File `docker-compose.yml` Ada

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
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U meta -d meta_vrp"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql+psycopg://meta:dev@db:5432/meta_vrp
      CORS_ORIGINS: http://localhost:5173
    depends_on:
      db:
        condition: service_healthy
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
      - /app/node_modules

volumes:
  meta_vrp_pgdata:
```

### 2. Build & Run

```bash
docker compose up --build
```

Semua service akan berjalan:
- **Database:** `localhost:5432`
- **Backend:** `localhost:8000`
- **Frontend:** `localhost:5173`

### 3. Stop Services

```bash
docker compose down
# Atau dengan menghapus volumes:
docker compose down -v
```

---

## 📂 Struktur Proyek

```text
meta-vrp/
├── .github/
│   └── workflows/          # CI/CD configuration (GitHub Actions)
├── backend/
│   ├── engine/             # ALNS Algorithm Core
│   │   ├── alns_solver.py  # Main ALNS implementation
│   │   ├── operators.py    # Destroy & Repair operators
│   │   └── utils.py        # Helper functions
│   ├── routers/            # FastAPI Endpoints
│   │   ├── optimize.py     # Optimization endpoints
│   │   └── data.py         # Data management endpoints
│   ├── migrations/         # Database migrations
│   │   └── schema_additions.sql
│   ├── data/               # Dataset CSV
│   │   ├── nodes.csv       # Park locations & demands
│   │   └── time_matrix.csv # OSRM distance matrix
│   ├── app.py              # FastAPI application entry
│   ├── requirements.txt    # Python dependencies
│   └── .env                # Backend environment variables
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI Components
│   │   │   ├── Map/        # Map visualization components
│   │   │   ├── Charts/     # Data visualization charts
│   │   │   └── Tables/     # Data display tables
│   │   ├── pages/          # Main Application Pages
│   │   │   ├── Optimize.tsx
│   │   │   ├── Logs.tsx
│   │   │   └── Dashboard.tsx
│   │   ├── stores/         # Zustand State Management
│   │   ├── lib/            # Utility functions
│   │   └── App.tsx         # Main application component
│   ├── package.json        # Node.js dependencies
│   ├── tsconfig.json       # TypeScript configuration
│   ├── vite.config.ts      # Vite configuration
│   └── .env                # Frontend environment variables
├── .pre-commit-config.yaml # Pre-commit hooks configuration
├── docker-compose.yml      # Docker orchestration
└── README.md               # Project documentation (this file)
```

---

## 🧩 Troubleshooting

| Masalah | Penyebab | Solusi |
|---------|----------|--------|
| `psql: command not found` | PostgreSQL CLI belum terinstal | Gunakan Docker one-off container (Opsi A Cara 2) |
| Backend gagal konek ke DB | `DATABASE_URL` salah atau DB belum running | Pastikan PostgreSQL aktif di `localhost:5432` |
| CORS error di browser | Origin frontend belum diizinkan | Tambahkan `http://localhost:5173` di `CORS_ORIGINS` |
| `Cannot find module '@/lib/...'` | Path alias tidak dikonfigurasi | Cek `tsconfig.json`: `"paths": { "@/*": ["src/*"] }` |
| Port 8000 sudah digunakan | Service lain menggunakan port tersebut | Ubah port di `uvicorn` command: `--port 8001` |
| `npm install` gagal | Node version tidak kompatibel | Gunakan Node.js v18 atau lebih baru |
| Database migration gagal | Connection timeout | Tunggu hingga container PostgreSQL ready (15-30 detik) |

---

## ⚡ Cheat Sheet (Quick Commands)

```bash
# ============================================
# INITIAL SETUP
# ============================================
git clone https://github.com/jasonnho/meta-vrp.git
cd meta-vrp

# Database (Docker)
docker run --name meta-vrp-pg \
  -e POSTGRES_DB=meta_vrp -e POSTGRES_USER=meta -e POSTGRES_PASSWORD=dev \
  -p 5432:5432 -v meta_vrp_pgdata:/var/lib/postgresql/data -d postgres:16

# Run migration
docker cp backend/migrations/schema_additions.sql meta-vrp-pg:/schema_additions.sql
docker exec -it meta-vrp-pg psql -U meta -d meta_vrp -f /schema_additions.sql

# Backend setup
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1  # Windows
# source .venv/bin/activate    # macOS/Linux
pip install -r requirements.txt
echo "DATABASE_URL=postgresql+psycopg://meta:dev@localhost:5432/meta_vrp" > .env
echo "CORS_ORIGINS=http://localhost:5173" >> .env

# Frontend setup
cd ../frontend
npm install
echo "VITE_API_BASE=http://localhost:8000" > .env

# ============================================
# DAILY DEVELOPMENT
# ============================================
# Terminal 1 (Backend)
cd backend && source .venv/bin/activate
uvicorn backend.app:app --reload --port 8000

# Terminal 2 (Frontend)
cd frontend
npm run dev

# ============================================
# CODE QUALITY CHECKS
# ============================================
# Frontend
cd frontend
npm run lint && npm run format

# Backend
cd backend
black . && ruff check .

# All (from root)
pre-commit run --all-files

# ============================================
# DOCKER COMPOSE
# ============================================
docker compose up --build    # Start all services
docker compose down          # Stop all services
docker compose logs -f       # View logs
```

---

## 🤝 Kontribusi

Kami menerima kontribusi dari siapa saja! Ikuti panduan berikut:

### Workflow Kontribusi

1. **Fork** repository ini
2. **Clone** fork Anda: `git clone https://github.com/YOUR_USERNAME/meta-vrp.git`
3. **Buat branch** fitur: `git checkout -b feature/nama-fitur-anda`
4. **Install pre-commit hooks:** `pre-commit install`
5. **Commit** perubahan: `git commit -m "feat: deskripsi fitur"`
6. **Push** ke branch: `git push origin feature/nama-fitur-anda`
7. **Buat Pull Request** ke branch `main`

### Standar Kualitas

* ✅ Semua commit **harus** lolos pre-commit checks
* ✅ Pipeline CI di GitHub harus **hijau (Passed)**
* ✅ Gunakan conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
* ✅ Tambahkan tests untuk fitur baru (jika applicable)
* ✅ Update dokumentasi jika ada perubahan API atau fitur

---

## 📄 License

Proyek ini dilisensikan di bawah **MIT License**. Lihat file [LICENSE](LICENSE) untuk detail lengkap.

---

## 👥 Tim Pengembang

**Meta-VRP Project** — Capstone Project 2025

* Algorithm Design & Backend Development
* Frontend Development & UI/UX
* DevOps & Infrastructure

---

## 📞 Kontak & Support

* **Repository:** [github.com/jasonnho/meta-vrp](https://github.com/jasonnho/meta-vrp)
* **Issues:** [GitHub Issues](https://github.com/jasonnho/meta-vrp/issues)
* **Discussions:** [GitHub Discussions](https://github.com/jasonnho/meta-vrp/discussions)

---

© 2025 Meta-VRP Project. All rights reserved.
