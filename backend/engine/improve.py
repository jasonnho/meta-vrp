import time
from typing import Dict, List
from .data import Node, TimeMatrix
from .evaluation import total_time_minutes
from .neighborhoods import relocate_move, swap_move

def improve_routes(
    routes: List[List[str]],
    nodes: Dict[str, Node],
    tm: TimeMatrix,
    time_limit_sec: float = 3.0,
    max_no_improve: int = 50,
) -> List[List[str]]:
    start = time.time()
    best = [r[:] for r in routes]
    best_cost = total_time_minutes(best, nodes, tm)

    noimprove = 0
    while time.time() - start < time_limit_sec and noimprove < max_no_improve:
        improved = False

        # 1) Relocate
        cand, delta, ok = relocate_move(best, nodes, tm)
        if ok and delta < -1e-9:
            best = cand
            best_cost += delta
            improved = True

        # 2) Swap
        cand, delta, ok = swap_move(best, nodes, tm)
        if ok and delta < -1e-9:
            best = cand
            best_cost += delta
            improved = True

        if improved:
            noimprove = 0
        else:
            noimprove += 1

    return best
