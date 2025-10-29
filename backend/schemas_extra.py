# backend/schemas_estra.py
from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime


class ParkGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    node_ids: List[str] = Field(default_factory=list)


class ParkGroupOut(BaseModel):
    group_id: str
    name: str
    description: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    node_ids: List[str]


class OperatorCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    active: Optional[bool] = True


class OperatorOut(BaseModel):
    operator_id: str
    name: str
    phone: Optional[str]
    active: bool
    created_at: datetime


class VehicleCreate(BaseModel):
    plate: Optional[str] = None
    capacity_l: Optional[float] = None
    active: Optional[bool] = True


class VehicleOut(BaseModel):
    vehicle_id: str
    plate: Optional[str]
    capacity_l: Optional[float]
    active: bool
    created_at: datetime


class AssignPayload(BaseModel):
    assigned_vehicle_id: Optional[str] = None
    assigned_operator_id: Optional[str] = None
    status: Optional[str] = None


class StepStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None


class StepStatusOut(BaseModel):
    sequence_index: int
    status: str
    reason: Optional[str]
    ts: datetime
    author: Optional[str]


class JobListItem(BaseModel):
    job_id: str
    created_at: datetime
    label: Optional[str] = None
    vehicle_used: Optional[int] = None
    objective_time_min: Optional[float] = None
    makespan_min: Optional[float] = None
    time_matrix_version: Optional[str] = None
