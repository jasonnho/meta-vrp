from typing import Dict, List, Tuple, Optional
from .data import Node, TimeMatrix
from .evaluation import route_time_minutes

# Utility: hitung delta biaya cepat untuk rute tertentu
def _route_cost(nodes: Dict[str, Node], tm: TimeMatrix, route: List[str]) -> float:
    return route_time_minutes(route, nodes, tm)

def relocate_move(
    routes: List[List[str]],
    nodes: Dict[str, Node],
    tm: TimeMatrix,
) -> Tuple[List[List[str]], float, bool]:
    """
    Relocate satu node 'park' dari posisi A ke posisi B (intra & inter-route).
    Return: (routes_baru, delta, improved?)
    """
    best_delta = 0.0
    best: Optional[Tuple[int, int, int]] = None  # (r_from, idx_from, r_to_pos)

    # precompute route costs
    base_costs = [ _route_cost(nodes, tm, r) for r in routes ]

    for rf, route_f in enumerate(routes):
        # index park dalam route_f (bukan depot di 0 dan bukan depot terakhir)
        idx_parks_f = [i for i in range(1, len(route_f)-1) if nodes[route_f[i]].type == "park"]
        for i in idx_parks_f:
            nid = route_f[i]
            # coba pindah ke setiap posisi di semua rute (termasuk rute yang sama)
            for rt, route_t in enumerate(routes):
                for j in range(1, len(route_t)):  # sisip sebelum index j
                    # tidak masuk akal sisip di posisi yang sama
                    if rf == rt and (j == i or j == i+1):
                        continue

                    # bangun rute calon
                    new_routes = [r[:] for r in routes]
                    take = new_routes[rf].pop(i)
                    if rf == rt and j > i:
                        j -= 1  # setelah pop, index geser
                    new_routes[rt].insert(j, take)

                    # hitung delta biaya hanya untuk rute yang berubah
                    affected = {rf, rt}
                    new_cost = sum(
                        _route_cost(nodes, tm, new_routes[k]) if k in affected else base_costs[k]
                        for k in range(len(routes))
                    )
                    old_cost = sum(base_costs)
                    delta = new_cost - old_cost
                    if delta < best_delta - 1e-9:
                        best_delta = delta
                        best = (rf, i, (rt << 16) | j)  # pack r_to & pos
    if best is None:
        return routes, 0.0, False

    rf, i, packed = best
    rt, j = (packed >> 16), (packed & 0xFFFF)
    new_routes = [r[:] for r in routes]
    nid = new_routes[rf].pop(i)
    if rf == rt and j > i:
        j -= 1
    new_routes[rt].insert(j, nid)
    return new_routes, best_delta, True


def swap_move(
    routes: List[List[str]],
    nodes: Dict[str, Node],
    tm: TimeMatrix,
) -> Tuple[List[List[str]], float, bool]:
    """
    Tukar dua node 'park' antar posisi (intra & inter-route).
    """
    best_delta = 0.0
    best = None  # (r1,i1,r2,i2)

    base_costs = [ _route_cost(nodes, tm, r) for r in routes ]

    for r1, route1 in enumerate(routes):
        idx1 = [i for i in range(1, len(route1)-1) if nodes[route1[i]].type == "park"]
        for r2 in range(r1, len(routes)):
            route2 = routes[r2]
            idx2 = [i for i in range(1, len(route2)-1) if nodes[route2[i]].type == "park"]
            for i1 in idx1:
                for i2 in idx2:
                    if r1 == r2 and i1 == i2:
                        continue
                    new_routes = [r[:] for r in routes]
                    new_routes[r1][i1], new_routes[r2][i2] = new_routes[r2][i2], new_routes[r1][i1]
                    affected = {r1, r2}
                    new_cost = sum(
                        _route_cost(nodes, tm, new_routes[k]) if k in affected else base_costs[k]
                        for k in range(len(routes))
                    )
                    old_cost = sum(base_costs)
                    delta = new_cost - old_cost
                    if delta < best_delta - 1e-9:
                        best_delta = delta
                        best = (r1, i1, r2, i2)

    if best is None:
        return routes, 0.0, False

    r1, i1, r2, i2 = best
    new_routes = [r[:] for r in routes]
    new_routes[r1][i1], new_routes[r2][i2] = new_routes[r2][i2], new_routes[r1][i1]
    return new_routes, best_delta, True
