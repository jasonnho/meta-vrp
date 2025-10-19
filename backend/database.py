# database.py
import os
from dotenv import load_dotenv  # <--- 1. TAMBAHKAN INI
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()  # <--- 1. TAMBAHKAN INI JUGA, UNTUK MEMBACA FILE .env

# --- 2. UBAH BAGIAN INI ---
# Hapus nilai default yang ada password-nya
DATABASE_URL = os.getenv("DATABASE_URL")

# (Opsional tapi sangat disarankan)
# Tambah pengecekan ini agar program langsung error jika .env lupa dibuat
if not DATABASE_URL:
    raise ValueError("Error: DATABASE_URL tidak ditemukan. Cek file .env kamu.")
# ---------------------------

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
