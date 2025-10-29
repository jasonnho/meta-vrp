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
    capacity_trace_and_violations,
)
from .engine.evaluation import (
    total_time_minutes,
    route_time_minutes,
    load_profile_liters,
    makespan_minutes,  #  baru
)
from .engine.improve import improve_routes
from .engine.alns import alns_optimize, ALNSConfig
from .engine.utils import ensure_all_routes_capacity
from .engine.utils import build_groups_from_expanded_ids
from .engine.utils import ensure_all_routes_capacity, ensure_groups_single_vehicle

from .routers import (
    routes_groups,
    routes_catalog,
    routes_assign,
    routes_status,
    routes_history,
)

from uuid import uuid4
from datetime import datetime, timezone
from .database import SessionLocal
from .models import JobVehicleRun, JobStepStatus


from .engine.data import Node, TimeMatrix  # pastikan impor (local reference)
from uuid import uuid4
from datetime import datetime, timezone
import logging

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


# === helper: belah satu rute menjadi K rute berbasis beban === # --- helper: belah satu rute menjadi K rute berbasis beban (VERSI GROUP-AWARE - FIX Error '.get()') ---


def split_route_into_k_by_load(
    route: List[str],
    nodes: Dict[str, Node],
    vehicle_capacity: float,  # <-- Tidak dipakai di logic ini, tapi biarkan
    k: int,
    depot_id: str,
    groups: Dict[str, List[str]],  # <-- groups data
    part_to_group: Dict[str, str],  # <-- part mapping data
) -> List[List[str]]:
    if k <= 1 or len(route) <= 2:
        return [route[:]]  # Tidak perlu split

    # Cari indeks semua node park di rute
    parks_idx = []
    for i in range(1, len(route) - 1):
        node = nodes.get(route[i])
        if node and node.type == "park":
            parks_idx.append(i)

    if len(parks_idx) < k - 1:
        # Jumlah park lebih sedikit dari jumlah potongan yg dibutuhkan
        return [route[:]]

    total_demand = sum(
        nodes[route[i]].demand_liters for i in parks_idx if route[i] in nodes
    )
    if total_demand <= 0:
        return [route[:]]

    target = total_demand / k
    cuts = []
    acc = 0.0
    next_target = target

    # Cari titik potong yang aman (tidak memisah grup)
    last_valid_idx_before_target = -1

    for i in parks_idx:
        current_node_id = route[i]
        node_obj = nodes.get(current_node_id)
        if not node_obj:
            continue  # Skip if node data missing

        # --- PENGECEKAN GROUP-AWARE ---
        is_safe_cut_point = True
        if i + 1 < len(route) - 1:  # Pastikan ada node setelah ini
            next_node_id = route[i + 1]
            # Hanya cek jika node BERIKUTNYA adalah 'park' juga
            next_node_obj = nodes.get(next_node_id)
            if next_node_obj and next_node_obj.type == "park":
                current_group = part_to_group.get(current_node_id)
                next_group = part_to_group.get(next_node_id)
                # Potongan TIDAK aman jika node ini dan node park berikutnya
                # berasal dari grup split yang sama
                if current_group and next_group and current_group == next_group:
                    is_safe_cut_point = False
        # --- AKHIR PENGECEKAN ---

        # Akumulasi demand
        acc += node_obj.demand_liters

        # Catat indeks aman terakhir SEBELUM target tercapai
        if acc < next_target - 1e-9 and is_safe_cut_point:
            last_valid_idx_before_target = i

        # Jika target tercapai atau terlewati
        if acc >= next_target - 1e-9:
            cut_point_found = False
            # Apakah titik SEKARANG (i) aman untuk dipotong?
            if is_safe_cut_point:
                cuts.append(i)  # Potong di sini
                cut_point_found = True
            # Jika tidak aman, coba potong di titik aman terakhir SEBELUM target
            elif last_valid_idx_before_target != -1:
                # Pastikan titik potong sebelumnya belum dipakai
                if not cuts or cuts[-1] != last_valid_idx_before_target:
                    cuts.append(last_valid_idx_before_target)
                    cut_point_found = True
            # Jika tidak ada titik aman (jarang), lewati target ini

            # Hanya reset 'last_valid_idx_before_target' jika potongan ditemukan
            if cut_point_found:
                last_valid_idx_before_target = -1
                # Set target berikutnya
                next_target += target

            # Berhenti jika sudah cukup potongan
            if len(cuts) >= k - 1:
                break

    # --- Sanitasi (PERBAIKAN ERROR .get()) ---
    def sanitize(seg: List[str]) -> List[str]:
        # 1) remove consecutive duplicates
        cleaned = [seg[0]]
        for nid in seg[1:]:
            if nid != cleaned[-1]:
                cleaned.append(nid)

        # 2) drop refill right before depot (FIXED)
        if len(cleaned) >= 3 and cleaned[-1] == depot_id:
            node_before_depot = nodes.get(cleaned[-2])  # Pakai .get() di DICT nodes
            if (
                node_before_depot and node_before_depot.type == "refill"
            ):  # Akses .type LANGSUNG
                cleaned.pop(-2)

        # 3) if no parks left, return empty (FIXED)
        has_park = False
        for n_id in cleaned[1:-1]:
            node_obj = nodes.get(n_id)  # Pakai .get() di DICT nodes
            if node_obj and node_obj.type == "park":  # Akses .type LANGSUNG
                has_park = True
                break
        return cleaned if has_park and len(cleaned) > 2 else []

    # --- Akhir Sanitasi ---

    # --- Membuat Segmen (Tidak berubah) ---
    segments = []
    prev = 0
    # Pastikan cuts diurutkan untuk slicing yang benar
    cuts.sort()
    for cut in cuts:
        # Pastikan cut index valid
        if cut < len(route) - 1 and cut > prev:  # Tambah cek cut > prev
            seg = [depot_id] + route[prev + 1 : cut + 1] + [depot_id]
            seg = sanitize(seg)
            if seg:
                segments.append(seg)
            prev = cut
        elif cut <= prev:
            # Jika ada cut duplikat atau tidak berurut, skip
            pass

    # Segmen terakhir
    seg = [depot_id] + route[prev + 1 : -1] + [depot_id]
    seg = sanitize(seg)
    if seg:
        segments.append(seg)

    # Pad jika perlu (Tidak berubah)
    while len(segments) < k:
        segments.append([depot_id, depot_id])

    # Jika hasilnya > k (karena potongan yg dipaksa), gabungkan yg terakhir (Tidak berubah)
    while len(segments) > k and len(segments) > 1:
        last = segments.pop()
        if len(segments[-1]) > 1 and len(last) > 2:
            segments[-1] = segments[-1][:-1] + last[1:-1] + [depot_id]
        elif len(last) > 2:
            segments[-1] = last

    return segments


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

    nodes_exp, tm_exp, selected_ids_expanded = expand_split_delivery(
        nodes_orig, tm_orig, selected_raw, settings.VEHICLE_CAPACITY_LITERS
    )

    groups, part_to_group = build_groups_from_expanded_ids(selected_ids_expanded)

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

    # === TIME BUDGET & ALNS CONFIG ===
    TOTAL_TL = float(getattr(settings, "TIME_LIMIT_SEC", 6.0))
    ALNS_FRAC = float(getattr(settings, "ALNS_TIME_FRAC", 0.6))  # 60% ke ALNS
    USE_ALNS = bool(getattr(settings, "USE_ALNS", True))
    LAMBDA_CAP = float(
        getattr(settings, "ALNS_LAMBDA_CAPACITY", 0.0)
    )  # penalti kapasitas (0=off)

    alns_time = max(0.0, TOTAL_TL * ALNS_FRAC)
    improv_time = max(0.1, TOTAL_TL - alns_time)

    alns_cfg = ALNSConfig(
        time_limit_sec=alns_time,
        seed=int(time.time()),
        init_temperature=float(getattr(settings, "ALNS_INIT_TEMP", 1_000.0)),
        cooling_rate=float(getattr(settings, "ALNS_COOLING_RATE", 0.995)),
        min_temperature=float(getattr(settings, "ALNS_MIN_TEMP", 1e-3)),
        k_remove_min=int(getattr(settings, "ALNS_K_REMOVE_MIN", 2)),
        k_remove_max=int(getattr(settings, "ALNS_K_REMOVE_MAX", 8)),
        score_update_period=int(getattr(settings, "ALNS_SCORE_UPDATE_PERIOD", 25)),
        tabu_tenure=int(getattr(settings, "ALNS_TABU_TENURE", 20)),
        use_tabu_on_removed_nodes=bool(
            getattr(settings, "ALNS_USE_TABU_ON_REMOVED", True)
        ),
        lambda_capacity=LAMBDA_CAP,
        use_construct_as_repair=bool(
            getattr(settings, "ALNS_USE_CONSTRUCT_AS_REPAIR", False)
        ),
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

    if len(routes) == 1 and req.num_vehicles > 1:
        routes = split_route_into_k_by_load(
            route=routes[0],
            nodes=nodes_exp,
            vehicle_capacity=settings.VEHICLE_CAPACITY_LITERS,
            k=req.num_vehicles,
            depot_id=depot_id,
            groups=groups,  # <-- TAMBAHKAN INI
            part_to_group=part_to_group,
        )

    # 7) ALNS (opsional) → lalu IMPROVE
    alns_dur = 0.0
    improv_dur = 0.0

    if USE_ALNS and alns_time > 0.05:
        log.info("ALNS start (limit=%.1fs)", alns_cfg.time_limit_sec)
        t_alns0 = time.perf_counter()
        routes = run_step(
            lambda: alns_optimize(
                init_routes=routes,
                nodes=nodes_exp,
                tm=tm_exp,
                vehicle_capacity=settings.VEHICLE_CAPACITY_LITERS,
                refill_ids=refill_ids,
                depot_id=depot_id,
                allow_refill=settings.ALLOW_REFILL,
                cfg=alns_cfg,
                groups=groups,
            ),
            timeout_sec=alns_cfg.time_limit_sec + 1.0,  # sedikit buffer
            name="alns_optimize",
        )
        t_alns1 = time.perf_counter()
        alns_dur = t_alns1 - t_alns0
        log.info("ALNS done in %.3fs", alns_dur)
    else:
        log.info("ALNS skipped (USE_ALNS=%s, time=%.2fs)", USE_ALNS, alns_time)

    log.info("IMPROVE start (limit=%.1fs)", improv_time)
    t_impr0 = time.perf_counter()
    routes = improve_routes(
        routes,
        nodes_exp,
        tm_exp,
        vehicle_capacity=settings.VEHICLE_CAPACITY_LITERS,  # ⬅️ baru
        refill_ids=refill_ids,  # ⬅️ baru
        depot_id=depot_id,  # ⬅️ baru
        time_limit_sec=improv_time,
        max_no_improve=settings.IMPROVE_MAX_NO_IMPROVE,
        groups=groups,
    )
    t_impr1 = time.perf_counter()
    improv_dur = t_impr1 - t_impr0
    log.info("IMPROVE done in %.3fs", improv_dur)

    # === TAMBAHKAN KEMBALI BLOK INI ===
    # === TAMBAHKAN LOGGING SEBELUM & SESUDAH ===
    log.info("ENSURE GROUPS start")
    routes_before_ensure = [r[:] for r in routes]  # Salin kondisi sebelum
    t_eg0 = time.perf_counter()
    routes = ensure_groups_single_vehicle(
        routes,
        groups,
        nodes_exp,
        tm_exp,
        depot_id,
        vehicle_capacity=settings.VEHICLE_CAPACITY_LITERS,
        refill_ids=refill_ids,
    )
    t_eg1 = time.perf_counter()
    ensure_groups_dur = t_eg1 - t_eg0
    log.info(f"ENSURE GROUPS done in {ensure_groups_dur:.3f}s")  # Gunakan f-string

    # Cek apakah rute berubah
    if routes != routes_before_ensure:
        log.warning("!!! ENSURE GROUPS HAS MODIFIED THE ROUTES !!!")  # Pesan peringatan
        # Opsional (jika ingin lihat detail, tapi bisa sangat panjang):
        # log.debug(f"Routes BEFORE ensure_groups: {routes_before_ensure}")
        # log.debug(f"Routes AFTER ensure_groups: {routes}")
    else:
        log.info("Ensure Groups: Routes remain unchanged.")  # Konfirmasi tidak berubah
    # === AKHIR BLOK LOGGING ===

    routes, _final_ins = ensure_all_routes_capacity(
        routes,
        nodes_exp,
        settings.VEHICLE_CAPACITY_LITERS,
        refill_ids,
        tm_exp,
        depot_id,
    )

    # final safety: satukan grup + kapasitas

    # 8) EVALUATE (pakai nodes_exp, tm_exp)
    obj_time = makespan_minutes(routes, nodes_exp, tm_exp)
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

    route_refills = []
    for r in routes:
        refill_pos = [i for i, nid in enumerate(r) if nodes_exp[nid].type == "refill"]
        route_refills.append({"sequence": r, "refill_indices": refill_pos})

    cap_diag = []
    for vid, r in enumerate(routes):
        trace, viol = capacity_trace_and_violations(
            r, nodes_exp, settings.VEHICLE_CAPACITY_LITERS
        )
        if viol:
            cap_diag.append(
                {
                    "vehicle_id": vid,
                    "sequence": r,
                    "violations": [
                        {"idx": i, "node": nid, "liters_short": short}
                        for (i, nid, short) in viol
                    ],
                }
            )

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
                "alns": round(alns_dur, 4),  # ⬅️ waktu ALNS
                "improve": round(improv_dur, 4),  # ⬅️ waktu improve real
                "evaluate": round(t_eval - max(t_impr1, t_cons), 4),
                "total": round(t_eval - t0, 4),
            },
            "expanded": {
                "selected_in": selected_raw,  # input user
                "selected_expanded": selected_ids_expanded,  # hasil split-delivery
            },
            "alns_config": {  # bantu debug
                "used": USE_ALNS,
                "time_limit_sec": alns_cfg.time_limit_sec if USE_ALNS else 0.0,
                "lambda_capacity": alns_cfg.lambda_capacity,
                "k_remove": [alns_cfg.k_remove_min, alns_cfg.k_remove_max],
            },
            "refill_positions": route_refills,
            "capacity_violations": cap_diag,
            "expanded": {
                "selected_in": selected_raw,
                "selected_expanded": selected_ids_expanded,
                "groups_count": len(groups),  # ⬅️ optional
            },
        },
    )


app.include_router(routes_groups.router)
app.include_router(routes_catalog.router)
app.include_router(routes_assign.router)
app.include_router(routes_status.router)
app.include_router(routes_history.router)


log = logging.getLogger(__name__)


def _to_node_id(x):
    # adapt ke format sequence kamu: string, int, dict, tuple, dsb.
    if isinstance(x, dict):
        # coba beberapa kunci umum
        return x.get("node_id") or x.get("id") or x.get("node") or str(x)
    return str(x)


@app.post("/optimize", response_model=OptimizeResponse)
def optimize(req: OptimizeRequest):
    hard_timeout = max(3.0, settings.TIME_LIMIT_SEC + 5.0)
    try:
        fut = EXECUTOR.submit(_solve, req)
        result = fut.result(timeout=hard_timeout)

        if not isinstance(result, dict):
            result = result.dict()

        routes = result.get("routes", [])
        if not routes:
            result["job_id"] = None
            return result

        db = SessionLocal()
        job_id = uuid4()           # ← UUID object
        job_id_str = str(job_id)   # ← For response
        now = datetime.now(timezone.utc)

        try:
            for r in routes:
                vehicle_id = r.get("vehicle_id") or getattr(r, "vehicle_id", None)
                total_time_min = r.get("total_time_min") or getattr(r, "total_time_min", None)
                sequence = r.get("sequence", []) or getattr(r, "sequence", [])

                if vehicle_id is None:
                    continue

                db.add(
                    JobVehicleRun(
                        job_id=job_id,
                        vehicle_id=vehicle_id,
                        route_total_time_min=total_time_min,
                        status="planned",
                    )
                )
                db.flush()

                for idx, node in enumerate(sequence):
                    db.add(
                        JobStepStatus(
                            job_id=job_id,
                            vehicle_id=vehicle_id,
                            sequence_index=idx,
                            node_id=_to_node_id(node),
                            status="planned",
                            ts=now,
                            author="system",
                        )
                    )
                db.flush()

            db.commit()
        except Exception as e:
            db.rollback()
            log.exception("Failed to save log: %s", e)
            raise HTTPException(status_code=500, detail=f"Failed to save log: {e}")
        finally:
            db.close()

        result["job_id"] = job_id_str
        return result

    except FTimeout:
        raise HTTPException(status_code=504, detail=f"Timed out after {hard_timeout:.1f}s")
    except Exception as e:
        log.exception("Unhandled error")
        raise HTTPException(status_code=500, detail=str(e))


# --- tambahkan di app.py (atau bikin router terpisah) ---
from pydantic import BaseModel
from typing import Optional, Literal, List


class NodeOut(BaseModel):
    id: str
    name: Optional[str] = None
    lat: float
    lon: float
    kind: Optional[Literal["depot", "refill", "park"]] = None


@app.get("/nodes", response_model=List[NodeOut])
def list_nodes():
    try:
        nodes_dict, ids_in_order = load_nodes_csv(settings.DATA_NODES_PATH)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read nodes: {e}")

    out: List[NodeOut] = []
    for nid in ids_in_order:
        n = nodes_dict[nid]
        # field di Node: id, name, lat, lon, type, demand_liters, service_min
        out.append(
            NodeOut(
                id=n.id,
                name=getattr(n, "name", None),
                lat=float(n.lat),
                lon=float(n.lon),
                kind=getattr(n, "type", None),
            )
        )
    return out
