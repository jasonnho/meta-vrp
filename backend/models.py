# backend/models.py
from sqlalchemy import (
    String, Boolean, Text, Numeric, Integer, ForeignKey, TIMESTAMP
)
from sqlalchemy.dialects.sqlite import BLOB as SQLITE_UUID
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from uuid import UUID as PythonUUID, uuid4
from .database import Base
import os


# === UUID Column Helper (SQLite + Postgres) ===
def UUIDCol(primary_key: bool = False, foreign_key: str | None = None):
    """Return UUID column for Postgres, String for SQLite"""
    is_sqlite = os.getenv("DATABASE_URL", "sqlite:///").startswith("sqlite")
    col_type = String if is_sqlite else PG_UUID(as_uuid=True)

    if foreign_key:
        fk_type = String if is_sqlite else PG_UUID(as_uuid=True)
        return mapped_column(fk_type, ForeignKey(foreign_key), primary_key=primary_key)
    else:
        return mapped_column(col_type, primary_key=primary_key, default=uuid4 if not is_sqlite else lambda: str(uuid4()))


# ================== Park Groups ==================
class ParkGroup(Base):
    __tablename__ = "park_groups"

    group_id: Mapped[PythonUUID] = UUIDCol(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str | None] = mapped_column(String)
    created_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    items: Mapped[list["ParkGroupItem"]] = relationship(
        "ParkGroupItem", cascade="all, delete-orphan", back_populates="group"
    )


class ParkGroupItem(Base):
    __tablename__ = "park_group_items"

    group_id: Mapped[PythonUUID] = UUIDCol(foreign_key="park_groups.group_id", primary_key=True)
    node_id: Mapped[str] = mapped_column(String, primary_key=True)
    group: Mapped[ParkGroup] = relationship("ParkGroup", back_populates="items")


# ================== Operators & Vehicles ==================
class Operator(Base):
    __tablename__ = "operators"

    operator_id: Mapped[PythonUUID] = UUIDCol(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str | None] = mapped_column(String)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )


class Vehicle(Base):
    __tablename__ = "vehicles"

    vehicle_id: Mapped[PythonUUID] = UUIDCol(primary_key=True)
    plate: Mapped[str | None] = mapped_column(String, unique=True)
    capacity_l: Mapped[float | None] = mapped_column(Numeric)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )


# ================== Job Vehicle Run ==================
class JobVehicleRun(Base):
    __tablename__ = "vrp_job_vehicle_runs"

    job_id: Mapped[PythonUUID] = UUIDCol(primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(Integer, primary_key=True)

    route_total_time_min: Mapped[float | None] = mapped_column(Numeric)
    expected_finish_local = mapped_column(TIMESTAMP(timezone=False), nullable=True)
    assigned_vehicle_id: Mapped[PythonUUID | None] = UUIDCol(foreign_key="vehicles.vehicle_id")
    assigned_operator_id: Mapped[PythonUUID | None] = UUIDCol(foreign_key="operators.operator_id")
    status: Mapped[str] = mapped_column(String, nullable=False, default="planned")
    created_at = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())


# ================== Job Step Status ==================
class JobStepStatus(Base):
    __tablename__ = "vrp_job_step_status"

    job_id: Mapped[PythonUUID] = UUIDCol(primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sequence_index: Mapped[int] = mapped_column(Integer, primary_key=True)

    node_id: Mapped[str | None] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    ts = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    author: Mapped[str | None] = mapped_column(String)
