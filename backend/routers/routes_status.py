from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import JobStepStatus
from ..schemas_extra import StepStatusOut, StepStatusUpdate

router = APIRouter(prefix="/jobs", tags=["status"])
VALID_STEP_STATUS = {"planned", "visited", "skipped", "failed"}


def now_utc():
    return datetime.now(timezone.utc)


@router.patch("/{job_id}/vehicles/{vid}/steps/{seq}", response_model=StepStatusOut)
def update_step_status(
    job_id: str,
    vid: int,
    seq: int,
    payload: StepStatusUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if payload.status not in VALID_STEP_STATUS:
        raise HTTPException(400, "Invalid step status")

    row = (
        db.query(JobStepStatus)
        .filter_by(job_id=job_id, vehicle_id=vid, sequence_index=seq)
        .first()
    )
    if not row:
        row = JobStepStatus(
            job_id=job_id,
            vehicle_id=vid,
            sequence_index=seq,
            status=payload.status,
            reason=payload.reason,
            ts=now_utc(),
            author=user.get("username"),
        )
        db.add(row)
    else:
        row.status = payload.status
        row.reason = payload.reason
        row.ts = now_utc()
        row.author = user.get("username")

    db.commit()
    return StepStatusOut(
        sequence_index=row.sequence_index,
        status=row.status,
        reason=row.reason,
        ts=row.ts,
        author=row.author,
    )


@router.get("/{job_id}/vehicles/{vid}/steps/status", response_model=list[StepStatusOut])
def get_all_step_status(job_id: str, vid: int, db: Session = Depends(get_db)):
    rows = (
        db.query(JobStepStatus)
        .filter_by(job_id=job_id, vehicle_id=vid)
        .order_by(JobStepStatus.sequence_index.asc())
        .all()
    )
    return [
        StepStatusOut(
            sequence_index=r.sequence_index,
            status=r.status,
            reason=r.reason,
            ts=r.ts,
            author=r.author,
        )
        for r in rows
    ]
