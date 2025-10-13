# app.py
import math
from typing import List, Dict, Tuple

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .engine.data import Node, TimeMatrix
from .schemas import OptimizeRequest, OptimizeResponse, RouteResult
from .settings import settings
from .engine.data import load_nodes_csv, load_time_matrix_csv
from .engine.construct import greedy_construct
from .engine.evaluation import (
    total_time_minutes,
    route_time_minutes,
    load_profile_liters,
)
from .engine.improve import improve_routes

# NOTE: saat debug, improve dimatikan dulu
# from .engine.improve import improve_routes

import time
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FTimeout
import numpy as np

app = FastAPI(
    title="Meta-VRP API",
    version="0.1",
    docs_url="/docs",
    swagger_ui_parameters={"displayRequestDuration": True, "tryItOutEnabled": True},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("meta-vrp")

# Eksekutor untuk hard-timeout endpoint & per-step
EXECUTOR = ThreadPoolExecutor(max_workers=1)
STEP_EXEC = ThreadPoolExecutor(max_workers=1)


def run_step(fn, timeout_sec: float, name: str):
    fut = STEP_EXEC.submit(fn)
    try:
        return fut.result(timeout=timeout_sec)
    except FTimeout:
        raise HTTPException(
            status_code=504, detail=f"{name} timed out after {timeout_sec:.1f}s"
        )


@app.get("/health")
def health_check():
    return {"status": "ok", "message": "FastAPI backend running"}


def expand_split_delivery(
    nodes: Dict[str, Node],
    tm: TimeMatrix,
    selected_ids: List[str],
    vehicle_capacity: float,
) -> Tuple[Dict[str, Node], TimeMatrix, List[str]]:
    """
    Pecah taman dengan demand > kapasitas menjadi beberapa node 'id#k' masing2 ≤ kapasitas.
    - Depot/refill tidak di-split.
    - TimeMatrix diperluas dengan menduplikasi baris/kolom berdasarkan id basis (sebelum '#').
    - selected_ids ikut diperluas: '1' → ['1#1','1#2',...].
    - Service time dibagi proporsional dengan liter yang dilayani per sub-node.
    """
    orig_ids: List[str] = tm.ids
    index = tm.index  # mapping id -> posisi di matrix asli

    new_nodes: Dict[str, Node] = {}
    new_ids: List[str] = []

    # Prehitung: node mana yang perlu split
    split_plan: Dict[str, int] = {}
    for nid in orig_ids:
        n = nodes[nid]
        if n.type == "park" and n.demand_liters > vehicle_capacity:
            k = math.ceil(n.demand_liters / vehicle_capacity)
            split_plan[nid] = k

    # Bangun daftar id baru (gantikan id besar dengan clone)
    for nid in orig_ids:
        n = nodes[nid]
        if nid in split_plan:
            k = split_plan[nid]
            total = n.demand_liters
            remaining = total
            for i in range(1, k + 1):
                served = min(vehicle_capacity, remaining)
                remaining -= served
                sub_id = f"{nid}#{i}"
                # service time proporsional terhadap liter yang dilayani
                sub_service = n.service_min * (served / total) if total > 0 else 0.0
                new_nodes[sub_id] = Node(
                    id=sub_id,
                    name=f"{n.name} (part {i}/{k})",
                    lat=n.lat,
                    lon=n.lon,
                    type=n.type,
                    demand_liters=served,
                    service_min=sub_service,
                )
                new_ids.append(sub_id)
        else:
            # tidak displit → salin apa adanya
            new_nodes[nid] = n
            new_ids.append(nid)

    # Bangun matrix baru dengan cara memetakan ke id basis (sebelum '#')
    # M2[i,j] = M[ idx(base(i)), idx(base(j)) ]
    m2 = np.zeros((len(new_ids), len(new_ids)), dtype=float)
    for i, nid_i in enumerate(new_ids):
        base_i = nid_i.split("#")[0]
        ii = index[base_i]
        for j, nid_j in enumerate(new_ids):
            base_j = nid_j.split("#")[0]
            jj = index[base_j]
            m2[i, j] = tm.M[ii, jj]

    tm2 = TimeMatrix(new_ids, m2)

    # Perluas selected_ids: kalau id displit, ganti jadi daftar sub-id
    expanded_selected: List[str] = []
    for sid in selected_ids:
        if sid in split_plan:
            k = split_plan[sid]
            expanded_selected.extend([f"{sid}#{i}" for i in range(1, k + 1)])
        else:
            expanded_selected.append(sid)

    return new_nodes, tm2, expanded_selected


def _solve(req: OptimizeRequest) -> OptimizeResponse:
    t0 = time.perf_counter()

    # 1) LOAD
    log.info(
        "LOAD start: nodes=%s, matrix=%s",
        settings.DATA_NODES_PATH,
        settings.DATA_MATRIX_PATH,
    )
    nodes_orig, ids_in_order = run_step(
        lambda: load_nodes_csv(settings.DATA_NODES_PATH), 3.0, "load_nodes_csv"
    )
    tm_orig = run_step(
        lambda: load_time_matrix_csv(settings.DATA_MATRIX_PATH, ids_in_order),
        3.0,
        "load_time_matrix_csv",
    )
    t_load = time.perf_counter()
    log.info("LOAD done in %.3fs", t_load - t0)

    # 2) VALIDASI input terhadap NODES ASLI (sebelum expand)
    if not req.selected_node_ids:
        raise HTTPException(
            status_code=400, detail="selected_node_ids tidak boleh kosong"
        )
    selected_raw = [str(x) for x in req.selected_node_ids]

    for nid in selected_raw:
        if nid not in nodes_orig:
            raise HTTPException(
                status_code=400, detail=f"Unknown node id (original dataset): {nid}"
            )
        if getattr(nodes_orig[nid], "type", None) != "park":
            raise HTTPException(
                status_code=400, detail=f"{nid} bukan type=park (original dataset)"
            )

    # 3) EXPAND SPLIT-DELIVERY (jika demand > kapasitas)
    #    Hasil: nodes_exp, tm_exp, selected_ids_expanded
    from .engine.data import Node, TimeMatrix  # pastikan impor

    nodes_exp, tm_exp, selected_ids_expanded = expand_split_delivery(
        nodes_orig, tm_orig, selected_raw, settings.VEHICLE_CAPACITY_LITERS
    )

    # 4) VALIDASI MATRIX setelah expand (pakai tm_exp)
    n = len(tm_exp.ids)
    tm_shape = getattr(getattr(tm_exp, "M", None), "shape", None)
    if tm_shape != (n, n):
        log.error(
            "Matrix shape diag | type(tm)=%s, has_M=%s, type(M)=%s, M_shape=%s, n=%d",
            type(tm_exp),
            hasattr(tm_exp, "M"),
            type(getattr(tm_exp, "M", None)),
            tm_shape,
            n,
        )
        raise HTTPException(
            status_code=400,
            detail=f"time_matrix shape mismatch: {tm_shape} vs ({n},{n})",
        )

    if not np.isfinite(tm_exp.M).all():
        bad = np.argwhere(~np.isfinite(tm_exp.M))
        raise HTTPException(
            status_code=400,
            detail=f"time_matrix contains NaN/Inf at indices (truncated) {bad[:10].tolist()}",
        )

    # pastikan semua selected (yang sudah di-expand) ada di index tm_exp
    missing_in_index = [nid for nid in selected_ids_expanded if nid not in tm_exp.ids]
    if missing_in_index:
        raise HTTPException(
            status_code=400,
            detail=f"expanded selected ids missing in matrix index: {missing_in_index}",
        )

    # 5) DEPOT & REFILL pakai nodes_exp (depot tidak di-split, jadi tetap ada)
    if (
        settings.DEPOT_ID in nodes_exp
        and getattr(nodes_exp[settings.DEPOT_ID], "type", None) == "depot"
    ):
        depot_id = settings.DEPOT_ID
    else:
        depots = [
            nid for nid, n in nodes_exp.items() if getattr(n, "type", None) == "depot"
        ]
        if len(depots) == 1:
            depot_id = depots[0]
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid DEPOT_ID in settings. Available depot IDs: {depots or 'NONE'}",
            )

    refill_ids = [
        nid for nid, n in nodes_exp.items() if getattr(n, "type", None) == "refill"
    ]

    t_val = time.perf_counter()
    log.info(
        "VALIDATION OK | parks(expanded)=%d, refills=%d, depot=%s",
        len(selected_ids_expanded),
        len(refill_ids),
        depot_id,
    )

    # 6) CONSTRUCT (pakai nodes_exp, tm_exp, selected_ids_expanded)
    log.info("CONSTRUCT start")
    routes = run_step(
        lambda: greedy_construct(
            nodes=nodes_exp,
            tm=tm_exp,
            selected_parks=selected_ids_expanded,  # <— PAKAI YANG EXPANDED
            depot_id=depot_id,
            num_vehicles=req.num_vehicles,
            vehicle_capacity=settings.VEHICLE_CAPACITY_LITERS,
            allow_refill=settings.ALLOW_REFILL,
            refill_ids=refill_ids,
        ),
        5.0,
        "greedy_construct",
    )
    t_cons = time.perf_counter()
    log.info("CONSTRUCT done in %.3fs", t_cons - t_val)

    # 7) (Optional) IMPROVE dimatikan dulu
    log.info("IMPROVE start (limit=%.1fs)", settings.TIME_LIMIT_SEC)
    routes = improve_routes(
        routes,
        nodes_exp,  # hasil expand
        tm_exp,  # hasil expand
        time_limit_sec=min(
            max(0.1, settings.TIME_LIMIT_SEC * 0.5), settings.TIME_LIMIT_SEC
        ),
        max_no_improve=10,
    )
    t_impr = time.perf_counter()
    log.info("IMPROVE done in %.3fs", t_impr - t_cons)

    # 8) EVALUATE (pakai nodes_exp, tm_exp)
    obj_time = total_time_minutes(routes, nodes_exp, tm_exp)
    results: list[RouteResult] = []
    for vid, r in enumerate(routes):
        if len(r) <= 2:
            continue
        results.append(
            RouteResult(
                vehicle_id=vid,
                sequence=r,
                total_time_min=route_time_minutes(r, nodes_exp, tm_exp),
                load_profile_liters=load_profile_liters(
                    r, nodes_exp, settings.VEHICLE_CAPACITY_LITERS
                ),
            )
        )
    t_eval = time.perf_counter()

    return OptimizeResponse(
        objective_time_min=obj_time,
        vehicle_used=len(results),
        routes=results,
        diagnostics={
            "depot_id": depot_id,
            "nodes_loaded": len(nodes_exp),
            "refill_count": len(refill_ids),
            "timing_sec": {
                "load": round(t_load - t0, 4),
                "validate": round(t_val - t_load, 4),
                "construct": round(t_cons - t_val, 4),
                "improve": 0.0,
                "evaluate": round(t_eval - t_impr, 4),
                "total": round(t_eval - t0, 4),
            },
            "expanded": {
                "selected_in": selected_raw,  # input user
                "selected_expanded": selected_ids_expanded,  # hasil split-delivery
            },
        },
    )


@app.post("/optimize", response_model=OptimizeResponse)
def optimize(req: OptimizeRequest):
    # Hard timeout di level endpoint, supaya Swagger nggak muter selamanya
    hard_timeout = max(3.0, settings.TIME_LIMIT_SEC + 5.0)
    try:
        fut = EXECUTOR.submit(_solve, req)
        return fut.result(timeout=hard_timeout)
    except FTimeout:
        raise HTTPException(
            status_code=504, detail=f"Optimization timed out after {hard_timeout:.1f}s"
        )
    except RuntimeError as e:
        # Error engine (mis. demand > kapasitas, no feasible move) jadi 400 yang jelas
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        log.exception("Unhandled error in /optimize")
        raise HTTPException(
            status_code=500, detail=f"Internal error: {type(e).__name__}: {e}"
        )
