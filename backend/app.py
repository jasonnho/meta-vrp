from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .schemas import OptimizeRequest, OptimizeResponse, RouteResult
from .settings import settings
from .engine.data import load_nodes_csv, load_time_matrix_csv
from .engine.construct import greedy_construct
from .engine.evaluation import total_time_minutes, route_time_minutes, load_profile_liters

app = FastAPI(title="Meta-VRP API", version="0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "FastAPI backend running"}

@app.post("/optimize", response_model=OptimizeResponse)
def optimize(req: OptimizeRequest):
    # 1) load data
    nodes = load_nodes_csv(settings.DATA_NODES_PATH)
    ids_sorted = sorted(nodes.keys())
    tm = load_time_matrix_csv(settings.DATA_MATRIX_PATH, ids_sorted)

    # 2) validasi input
    if not req.selected_node_ids:
        raise HTTPException(status_code=400, detail="selected_node_ids tidak boleh kosong")

    for nid in req.selected_node_ids:
        if nid not in nodes:
            raise HTTPException(status_code=400, detail=f"Unknown node id: {nid}")
        if nodes[nid].type != "park":
            raise HTTPException(status_code=400, detail=f"{nid} bukan type=park")
    if settings.DEPOT_ID not in nodes or nodes[settings.DEPOT_ID].type != "depot":
        raise HTTPException(status_code=500, detail="Invalid DEPOT_ID in settings")

    refill_ids = [nid for nid, n in nodes.items() if n.type == "refill"]

    # 3) konstruksi greedy baseline
    routes = greedy_construct(
        nodes=nodes,
        tm=tm,
        selected_parks=req.selected_node_ids,
        depot_id=settings.DEPOT_ID,
        num_vehicles=req.num_vehicles,
        vehicle_capacity=settings.VEHICLE_CAPACITY_LITERS,
        allow_refill=settings.ALLOW_REFILL,
        refill_ids=refill_ids,
    )

    # 4) evaluasi & bentuk response
    obj_time = total_time_minutes(routes, nodes, tm)
    results: list[RouteResult] = []
    for vid, r in enumerate(routes):
        if len(r) <= 2:
            continue  # rute kosong (depot→depot) lewati
        results.append(
            RouteResult(
                vehicle_id=vid,
                sequence=r,
                total_time_min=route_time_minutes(r, nodes, tm),
                load_profile_liters=load_profile_liters(r, nodes, settings.VEHICLE_CAPACITY_LITERS),
            )
        )

    return OptimizeResponse(
        objective_time_min=obj_time,
        vehicle_used=len(results),
        routes=results,
        diagnostics={
            "nodes_loaded": len(nodes),
            "matrix_size": len(ids_sorted),
            "refill_count": len(refill_ids),
        },
    )
