from fastapi import FastAPI

app = FastAPI(title="Meta-VRP API", version="0.1")

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "FastAPI backend running"}

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # sementara dibuka semua; nanti dibatasi ke origin React kamu
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from pydantic import BaseModel
from typing import List

class OptimizeRequest(BaseModel):
    selected_node_ids: List[str]
    depot_id: str
    num_vehicles: int = 2
    vehicle_capacity_liters: float = 5000.0

@app.post("/optimize")
def optimize_stub(req: OptimizeRequest):
    return {
        "message": "stub ok",
        "selected": req.selected_node_ids,
        "depot": req.depot_id,
        "num_vehicles": req.num_vehicles,
        "capacity": req.vehicle_capacity_liters
    }
