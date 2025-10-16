from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from ..database import get_db
from ..schemas_extra import JobListItem

router = APIRouter(prefix="/jobs", tags=["history"])


@router.get("", response_model=List[JobListItem])
def list_jobs(
    date_from: Optional[str] = Query(None),  # "2025-10-01"
    date_to: Optional[str] = Query(None),  # "2025-10-31"
    tag: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    sql = """
    SELECT job_id, created_at, label, vehicle_used, objective_time_min, makespan_min, time_matrix_version
    FROM vrp_jobs
    WHERE 1=1
    """
    params = {}
    if date_from:
        sql += " AND created_at >= :date_from"
        params["date_from"] = date_from
    if date_to:
        sql += " AND created_at < :date_to"
        params["date_to"] = date_to
    sql += " ORDER BY created_at DESC LIMIT 200"

    rows = db.execute(text(sql), params).fetchall()
    return [
        JobListItem(
            job_id=str(r[0]),
            created_at=r[1],
            label=r[2],
            vehicle_used=r[3],
            objective_time_min=float(r[4]) if r[4] is not None else None,
            makespan_min=float(r[5]) if r[5] is not None else None,
            time_matrix_version=r[6],
        )
        for r in rows
    ]


@router.get("/{job_id}/summary", response_model=dict)
def get_job_summary(job_id: str, db: Session = Depends(get_db)):
    job = db.execute(
        text(
            """
      SELECT job_id, created_at, label, vehicle_used, objective_time_min, makespan_min
      FROM vrp_jobs WHERE job_id = :jid
    """
        ),
        {"jid": job_id},
    ).first()
    if not job:
        return {"error": "not_found"}

    veh = db.execute(
        text(
            """
      SELECT vehicle_id, route_total_time_min, expected_finish_local, status,
             assigned_vehicle_id, assigned_operator_id
      FROM vrp_job_vehicle_runs
      WHERE job_id = :jid
      ORDER BY vehicle_id ASC
    """
        ),
        {"jid": job_id},
    ).fetchall()

    vehicles = []
    for v in veh:
        vehicles.append(
            {
                "vehicle_id": v[0],
                "route_total_time_min": float(v[1]) if v[1] is not None else None,
                "expected_finish_local": v[2],
                "status": v[3],
                "assigned_vehicle_id": v[4],
                "assigned_operator_id": v[5],
            }
        )

    return {
        "job": {
            "job_id": job[0],
            "created_at": job[1],
            "label": job[2],
            "vehicle_used": job[3],
            "objective_time_min": float(job[4]) if job[4] else None,
            "makespan_min": float(job[5]) if job[5] else None,
        },
        "vehicles": vehicles,
    }
