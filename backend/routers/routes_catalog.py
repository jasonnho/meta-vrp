from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import uuid4

from ..database import get_db
from ..models import Operator, Vehicle
from ..schemas_extra import OperatorCreate, OperatorOut, VehicleCreate, VehicleOut

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
