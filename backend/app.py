from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .schemas import OptimizeRequest, OptimizeResponse, RouteResult
from .settings import settings

app = FastAPI(title="Meta-VRP API", version="0.1")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

@app.post("/optimize", response_model=OptimizeResponse)
def optimize(req: OptimizeRequest):
    # Validasi input sederhana
    if len(req.selected_node_ids) == 0:
        raise HTTPException(status_code=400, detail="selected_node_ids tidak boleh kosong")

    # NANTI: panggil solver metaheuristik dengan parameter dari settings
    # contoh (pseudo):
    # sol = solve_metaheuristic(
    #     nodes, tm,
    #     selected_node_ids=req.selected_node_ids,
    #     depot_id=settings.DEPOT_ID,
    #     num_vehicles=req.num_vehicles,
    #     capacity=settings.VEHICLE_CAPACITY_LITERS,
    #     allow_refill=settings.ALLOW_REFILL,
    #     refill_service_min=settings.REFILL_SERVICE_MIN,
    #     lambda_use_min=settings.LAMBDA_USE_MIN,
    #     time_limit_sec=settings.TIME_LIMIT_SEC,
    # )

    # Untuk sekarang, kembalikan stub supaya alur UI jalan
    return OptimizeResponse(
        objective_time_min=0.0,
        vehicle_used=min(req.num_vehicles, 1 if req.selected_node_ids else 0),
        routes=[],
        diagnostics={
            "depot_id":  settings.DEPOT_ID,
            "capacity_l": settings.VEHICLE_CAPACITY_LITERS,
            "allow_refill": float(settings.ALLOW_REFILL),
            "refill_service_min": settings.REFILL_SERVICE_MIN,
            "lambda_use_min": settings.LAMBDA_USE_MIN,
            "time_limit_sec": settings.TIME_LIMIT_SEC,
        }
    )
