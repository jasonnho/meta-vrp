from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import JobVehicleRun, Operator, Vehicle
from ..schemas_extra import AssignPayload

router = APIRouter(prefix="/jobs", tags=["assign"])


@router.patch("/{job_id}/vehicles/{vid}", response_model=dict)
def assign_vehicle_operator(
    job_id: str, vid: int, payload: AssignPayload, db: Session = Depends(get_db)
):
    row = db.query(JobVehicleRun).filter_by(job_id=job_id, vehicle_id=vid).first()
    if not row:
        raise HTTPException(404, "Job vehicle run not found")

    if payload.assigned_operator_id:
        op = (
            db.query(Operator)
            .filter_by(operator_id=payload.assigned_operator_id)
            .first()
        )
        if not op or not op.active:
            raise HTTPException(400, "Operator not found or inactive")
        row.assigned_operator_id = payload.assigned_operator_id

    if payload.assigned_vehicle_id:
        vh = db.query(Vehicle).filter_by(vehicle_id=payload.assigned_vehicle_id).first()
        if not vh or not vh.active:
            raise HTTPException(400, "Vehicle not found or inactive")
        row.assigned_vehicle_id = payload.assigned_vehicle_id

    if payload.status:
        if payload.status not in ("planned", "in_progress", "done", "cancelled"):
            raise HTTPException(400, "Invalid status")
        row.status = payload.status

    db.commit()
    return {
        "job_id": row.job_id,
        "vehicle_id": row.vehicle_id,
        "assigned_vehicle_id": row.assigned_vehicle_id,
        "assigned_operator_id": row.assigned_operator_id,
        "status": row.status,
    }
