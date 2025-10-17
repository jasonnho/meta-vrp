from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime
from ..database import get_db
from ..models import JobVehicleRun, JobStepStatus

router = APIRouter(prefix="/jobs", tags=["history"])


def _parse_date(s: str | None):
    if not s:
        return None
    try:
        # Terima "YYYY-MM-DD" (tanpa timezone)
        return datetime.fromisoformat(s)
    except Exception:
        return None


@router.get("")
def list_jobs(
    date_from: str | None = Query(None, description="YYYY-MM-DD"),
    date_to: str | None = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """
    List job berdasarkan data yang ADA:
    - created_at   : MIN(ts) dari vrp_job_step_status untuk tiap job_id
    - vehicle_count: COUNT(DISTINCT vehicle_id) dari vrp_job_step_status
    """
    dt_from = _parse_date(date_from)
    dt_to = _parse_date(date_to)

    # Aggregate per job dari step status
    q = db.query(
        JobStepStatus.job_id.label("job_id"),
        func.min(JobStepStatus.ts).label("created_at"),
        func.count(func.distinct(JobStepStatus.vehicle_id)).label("vehicle_count"),
    ).group_by(JobStepStatus.job_id)

    # Filter tanggal (pakai HAVING karena pakai agregasi)
    if dt_from:
        q = q.having(func.min(JobStepStatus.ts) >= dt_from)
    if dt_to:
        q = q.having(func.min(JobStepStatus.ts) < dt_to)

    rows = q.order_by(desc(func.min(JobStepStatus.ts))).all()

    # Status job (opsional): ambil status dominan dari vehicle_runs jika ada
    # (planned/in_progress/done/cancelled). Kalau ga ada, default "planned".
    out = []
    for r in rows:
        status_row = (
            db.query(JobVehicleRun.status, func.count().label("cnt"))
            .filter(JobVehicleRun.job_id == r.job_id)
            .group_by(JobVehicleRun.status)
            .order_by(desc("cnt"))
            .first()
        )
        out.append(
            {
                "job_id": r.job_id,
                "created_at": r.created_at,
                "vehicle_count": r.vehicle_count,
                "status": status_row.status if status_row else "planned",
            }
        )
    return out


@router.get("/{job_id}/summary")
def get_job_summary(job_id: str, db: Session = Depends(get_db)):
    """
    Ringkasan job lengkap:
    - Info job
    - Daftar kendaraan beserta rute (sequence node_id)
    """
    # Ambil waktu dibuatnya job
    created_at_row = (
        db.query(func.min(JobStepStatus.ts))
        .filter(JobStepStatus.job_id == job_id)
        .first()
    )
    created_at = created_at_row[0] if created_at_row and created_at_row[0] else None

    # Ambil semua kendaraan dari job ini
    veh_rows = (
        db.query(
            JobVehicleRun.vehicle_id,
            JobVehicleRun.route_total_time_min,
            JobVehicleRun.expected_finish_local,
            JobVehicleRun.status,
            JobVehicleRun.assigned_vehicle_id,
            JobVehicleRun.assigned_operator_id,
        )
        .filter(JobVehicleRun.job_id == job_id)
        .order_by(JobVehicleRun.vehicle_id.asc())
        .all()
    )

    vehicles = []
    for v in veh_rows:
        # Ambil rute untuk kendaraan ini dari step status
        route_steps = (
            db.query(
                JobStepStatus.sequence_index,
                JobStepStatus.node_id,  # <-- tambahkan
                JobStepStatus.status,
                JobStepStatus.reason,
            )
            .filter(
                JobStepStatus.job_id == job_id,
                JobStepStatus.vehicle_id == v.vehicle_id,
            )
            .order_by(JobStepStatus.sequence_index.asc())
            .all()
        )

        # node_id tidak ada di JobStepStatus (kalau kamu ingin, bisa tambahkan kolom node_id nanti)
        # sementara ini kita pakai sequence_index + status saja

        route = [
            {
                "sequence_index": s.sequence_index,
                "node_id": s.node_id,  # <-- keluarkan ke response
                "status": s.status,
                "reason": s.reason,
            }
            for s in route_steps
        ]

        vehicles.append(
            {
                "vehicle_id": v.vehicle_id,
                "route_total_time_min": (
                    float(v.route_total_time_min)
                    if v.route_total_time_min is not None
                    else None
                ),
                "expected_finish_local": v.expected_finish_local,
                "status": v.status,
                "assigned_vehicle_id": v.assigned_vehicle_id,
                "assigned_operator_id": v.assigned_operator_id,
                "route": route,  # 🟢 rute tiap kendaraan
            }
        )

    return {
        "job": {
            "job_id": job_id,
            "created_at": created_at,
            "vehicle_count": len(vehicles),
        },
        "vehicles": vehicles,
    }


@router.get("/latest")
def get_latest_job(db: Session = Depends(get_db)):
    job = (
        db.query(JobVehicleRun.job_id)
        .order_by(desc(JobVehicleRun.job_id))
        .limit(1)
        .first()
    )
    return {"latest_job_id": job.job_id if job else None}
