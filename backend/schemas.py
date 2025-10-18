from typing import List, Dict, Any, Annotated
from pydantic import BaseModel, Field


class OptimizeRequest(BaseModel):
    selected_node_ids: Annotated[
        List[str],
        Field(
            min_length=1,  # ⬅️ pakai min_length untuk list/sequence
            description="ID taman yang dipilih (type=park)",
        ),
    ]
    num_vehicles: Annotated[
        int, Field(ge=1, description="Jumlah kendaraan yang digunakan")
    ]


class RouteResult(BaseModel):
    vehicle_id: int
    sequence: List[str]
    total_time_min: float
    load_profile_liters: List[float]


class OptimizeResponse(BaseModel):
    objective_time_min: float
    vehicle_used: int
    routes: List[RouteResult]
    diagnostics: Dict[str, Any] = Field(default_factory=dict)
