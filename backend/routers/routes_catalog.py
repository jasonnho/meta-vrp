from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import uuid4

from ..database import get_db
from fastapi import APIRouter, Depends, HTTPException, Query
from ..schemas_extra import OperatorCreate, OperatorOut, VehicleCreate, VehicleOut
from ..models import Operator, Vehicle
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select, exists

router = APIRouter(prefix="/catalog", tags=["catalog"])


# Operators
@router.post("/operators", response_model=OperatorOut)
def create_operator(payload: OperatorCreate, db: Session = Depends(get_db)):
    op = Operator(
        operator_id=str(uuid4()),
        name=payload.name,
        phone=payload.phone,
        active=bool(payload.active),
    )
    db.add(op)
    db.commit()
    return op


@router.get("/operators", response_model=List[OperatorOut])
def list_operators(active: Optional[bool] = Query(None), db: Session = Depends(get_db)):
    q = db.query(Operator)
    if active is not None:
        q = q.filter(Operator.active == active)
    return q.order_by(Operator.created_at.desc()).all()


# Vehicles
@router.post("/vehicles", response_model=VehicleOut)
def create_vehicle(payload: VehicleCreate, db: Session = Depends(get_db)):
    vh = Vehicle(
        vehicle_id=str(uuid4()),
        plate=payload.plate,
        capacity_l=payload.capacity_l,
        active=bool(payload.active),
    )
    db.add(vh)
    db.commit()
    return vh


@router.get("/vehicles", response_model=List[VehicleOut])
def list_vehicles(active: Optional[bool] = Query(None), db: Session = Depends(get_db)):
    q = db.query(Vehicle)
    if active is not None:
        q = q.filter(Vehicle.active == active)
    return q.order_by(Vehicle.created_at.desc()).all()


class OperatorUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    active: Optional[bool] = None


class VehicleUpdate(BaseModel):
    plate: Optional[str] = Field(None, description="harus unik")
    capacity_l: Optional[float] = None
    active: Optional[bool] = None


# =========================
# OPERATORS: UPDATE & DELETE
# =========================
@router.patch("/operators/{operator_id}")
def update_operator(
    operator_id: str, payload: OperatorUpdate, db: Session = Depends(get_db)
):
    op: Operator | None = db.get(Operator, operator_id)
    if not op:
        raise HTTPException(status_code=404, detail="Operator not found")

    if payload.name is not None:
        op.name = payload.name
    if payload.phone is not None:
        op.phone = payload.phone
    if payload.active is not None:
        op.active = payload.active

    db.commit()
    db.refresh(op)
    return op


@router.delete("/operators/{operator_id}")
def delete_operator(
    operator_id: str,
    hard: bool = Query(
        False, description="true untuk hard delete; default soft delete (active=false)"
    ),
    db: Session = Depends(get_db),
):
    op: Operator | None = db.get(Operator, operator_id)
    if not op:
        raise HTTPException(status_code=404, detail="Operator not found")

    if not hard:
        # soft delete
        op.active = False
        db.commit()
        return {"message": "Operator deactivated", "operator_id": operator_id}

    # hard delete (akan error jika masih direferensikan FK)
    try:
        db.delete(op)
        db.commit()
        return {"message": "Operator deleted", "operator_id": operator_id}
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Operator is still referenced by other records. Use soft delete (hard=false).",
        )


# ========================
# VEHICLES: UPDATE & DELETE
# ========================
@router.patch("/vehicles/{vehicle_id}")
def update_vehicle(
    vehicle_id: str, payload: VehicleUpdate, db: Session = Depends(get_db)
):
    v: Vehicle | None = db.get(Vehicle, vehicle_id)
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # validasi unik: plate tidak boleh dipakai kendaraan lain
    if payload.plate is not None and payload.plate != v.plate:
        dup = db.execute(
            select(
                exists().where(
                    Vehicle.plate == payload.plate, Vehicle.vehicle_id != vehicle_id
                )
            )
        ).scalar()
        if dup:
            raise HTTPException(status_code=409, detail="Plate already exists")

        v.plate = payload.plate

    if payload.capacity_l is not None:
        v.capacity_l = payload.capacity_l
    if payload.active is not None:
        v.active = payload.active

    db.commit()
    db.refresh(v)
    return v


@router.delete("/vehicles/{vehicle_id}")
def delete_vehicle(
    vehicle_id: str,
    hard: bool = Query(
        False, description="true untuk hard delete; default soft delete (active=false)"
    ),
    db: Session = Depends(get_db),
):
    v: Vehicle | None = db.get(Vehicle, vehicle_id)
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    if not hard:
        v.active = False
        db.commit()
        return {"message": "Vehicle deactivated", "vehicle_id": vehicle_id}

    try:
        db.delete(v)
        db.commit()
        return {"message": "Vehicle deleted", "vehicle_id": vehicle_id}
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Vehicle is still referenced by other records. Use soft delete (hard=false).",
        )
