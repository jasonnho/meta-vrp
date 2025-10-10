from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .schemas import OptimizeRequest, OptimizeResponse, RouteResult
from .settings import settings
from .engine.data import load_nodes_csv, load_time_matrix_csv

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
    nodes = load_nodes_csv(settings.DATA_NODES_PATH)
    ids_sorted = sorted(nodes.keys())
    tm = load_time_matrix_csv(settings.DATA_MATRIX_PATH, ids_sorted)

    # validasi input user
    if not req.selected_node_ids:
        raise HTTPException(status_code=400, detail="selected_node_ids tidak boleh kosong")
    for nid in req.selected_node_ids:
        if nid not in nodes:
            raise HTTPException(status_code=400, detail=f"Unknown node id: {nid}")
        if nodes[nid].type != "park":
            raise HTTPException(status_code=400, detail=f"{nid} bukan type=park")

    if settings.DEPOT_ID not in nodes or nodes[settings.DEPOT_ID].type != "depot":
        raise HTTPException(status_code=500, detail="Invalid DEPOT_ID in settings")

    # BELUM solve beneran — stub dulu
    return OptimizeResponse(
        objective_time_min=0.0,
        vehicle_used=min(req.num_vehicles, 1),
        routes=[],
        diagnostics={
            "depot_id": settings.DEPOT_ID,
            "nodes_loaded": len(nodes),
            "matrix_size": len(ids_sorted),
        },
    )
