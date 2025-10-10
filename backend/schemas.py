from pydantic import BaseModel, Field, conint
from typing import List, Dict

class OptimizeRequest(BaseModel):
    # Hanya dua input dari user:
    selected_node_ids: List[str] = Field(..., description="ID taman yang dipilih (type=park)")
    num_vehicles: conint(ge=1) = Field(..., description="Jumlah kendaraan yang digunakan")

class RouteResult(BaseModel):
    vehicle_id: int
    sequence: List[str]
    total_time_min: float
    load_profile_liters: List[float]

class OptimizeResponse(BaseModel):
    objective_time_min: float
    vehicle_used: int
    routes: List[RouteResult]
    diagnostics: Dict[str, float] = {}
