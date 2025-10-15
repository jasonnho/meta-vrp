# improve.py
import time
from typing import Dict, List
from .data import Node, TimeMatrix
from .evaluation import total_time_minutes
from .neighborhoods import (
    relocate_move,
    swap_move,
    two_opt_move,
)  # ⬅️ tambah two_opt_move
from .utils import ensure_all_routes_capacity  # ⬅️ pastikan sudah ada import ini


def improve_routes(
    routes: List[List[str]],
    nodes: Dict[str, Node],
    tm: TimeMatrix,
    vehicle_capacity: float,
    refill_ids: List[str],
    depot_id: str,
    time_limit_sec: float = 3.0,
    max_no_improve: int = 50,
) -> List[List[str]]:
    start = time.time()
    best = [r[:] for r in routes]
    best_cost = total_time_minutes(best, nodes, tm)

    # safety: pastikan feasible kapasitas di awal
    best, _ = ensure_all_routes_capacity(
        best, nodes, vehicle_capacity, refill_ids, tm, depot_id
    )

    noimprove = 0
    while time.time() - start < time_limit_sec and noimprove < max_no_improve:
        improved = False

        # 1) Relocate (Mode A: balancing dulu)
        cand, delta, ok = relocate_move(best, nodes, tm)
        if ok and delta < -1e-9:
            cand, _ = ensure_all_routes_capacity(
                cand, nodes, vehicle_capacity, refill_ids, tm, depot_id
            )
            new_cost = total_time_minutes(cand, nodes, tm)
            if new_cost < best_cost - 1e-9:
                best, best_cost = cand, new_cost
                improved = True

        # 2) Swap
        cand, delta, ok = swap_move(best, nodes, tm)
        if ok and delta < -1e-9:
            cand, _ = ensure_all_routes_capacity(
                cand, nodes, vehicle_capacity, refill_ids, tm, depot_id
            )
            new_cost = total_time_minutes(cand, nodes, tm)
            if new_cost < best_cost - 1e-9:
                best, best_cost = cand, new_cost
                improved = True

        # 3) 2-opt (polish intra-route)
        cand, delta, ok = two_opt_move(best, nodes, tm)
        if ok and delta < -1e-9:
            cand, _ = ensure_all_routes_capacity(
                cand, nodes, vehicle_capacity, refill_ids, tm, depot_id
            )
            new_cost = total_time_minutes(cand, nodes, tm)
            if new_cost < best_cost - 1e-9:
                best, best_cost = cand, new_cost
                improved = True

        noimprove = 0 if improved else (noimprove + 1)

    return best
