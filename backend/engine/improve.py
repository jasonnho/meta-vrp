# improve.py (VERSI BARU - Group-Aware)

import time
from typing import Dict, List
from .data import Node, TimeMatrix
from .evaluation import total_time_minutes
from .neighborhoods import (
    relocate_move,
    swap_move,
    two_opt_move,
)
from .utils import ensure_all_routes_capacity


def improve_routes(
    routes: List[List[str]],
    nodes: Dict[str, Node],
    tm: TimeMatrix,
    vehicle_capacity: float,
    refill_ids: List[str],
    depot_id: str,
    groups: Dict[str, List[str]],  # <-- TAMBAH INI
    time_limit_sec: float = 3.0,
    max_no_improve: int = 50,
) -> List[List[str]]:
    start = time.time()
    best = [r[:] for r in routes]

    # safety: pastikan feasible kapasitas di awal
    best, _ = ensure_all_routes_capacity(
        best, nodes, vehicle_capacity, refill_ids, tm, depot_id
    )
    best_cost = total_time_minutes(best, nodes, tm)

    noimprove = 0
    while time.time() - start < time_limit_sec and noimprove < max_no_improve:
        improved = False

        # 1) Relocate (Group-Aware)
        # Operasi ini HANYA akan memindahkan node non-split
        cand, delta, ok = relocate_move(best, nodes, tm, groups)  # <-- Tambah groups
        if ok and delta < -1e-9:
            cand, _ = ensure_all_routes_capacity(
                cand, nodes, vehicle_capacity, refill_ids, tm, depot_id
            )
            new_cost = total_time_minutes(cand, nodes, tm)
            if new_cost < best_cost - 1e-9:
                best, best_cost = cand, new_cost
                improved = True
                noimprove = 0  # Reset counter jika ada perbaikan
                continue  # Langsung ulangi loop

        # 2) Swap (Group-Aware)
        # Operasi ini HANYA akan menukar node non-split
        cand, delta, ok = swap_move(best, nodes, tm, groups)  # <-- Tambah groups
        if ok and delta < -1e-9:
            cand, _ = ensure_all_routes_capacity(
                cand, nodes, vehicle_capacity, refill_ids, tm, depot_id
            )
            new_cost = total_time_minutes(cand, nodes, tm)
            if new_cost < best_cost - 1e-9:
                best, best_cost = cand, new_cost
                improved = True
                noimprove = 0  # Reset counter
                continue  # Langsung ulangi loop

        # 3) 2-opt (Group-Aware)
        # Operasi ini HANYA akan membalik segmen yang TIDAK MENGANDUNG split-node
        cand, delta, ok = two_opt_move(best, nodes, tm, groups)  # <-- Tambah groups
        if ok and delta < -1e-9:
            cand, _ = ensure_all_routes_capacity(
                cand, nodes, vehicle_capacity, refill_ids, tm, depot_id
            )
            new_cost = total_time_minutes(cand, nodes, tm)
            if new_cost < best_cost - 1e-9:
                best, best_cost = cand, new_cost
                improved = True
                noimprove = 0  # Reset counter
                continue  # Langsung ulangi loop

        noimprove = noimprove + 1

    return best
