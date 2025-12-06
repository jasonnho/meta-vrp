# neighborhoods.py (VERSI BARU - Group-Aware)

from typing import Dict, List, Optional, Tuple

from .data import Node, TimeMatrix
from .evaluation import route_time_minutes


# Utility: hitung delta biaya cepat untuk rute tertentu
def _route_cost(nodes: Dict[str, Node], tm: TimeMatrix, route: List[str]) -> float:
    return route_time_minutes(route, nodes, tm)


def relocate_move(
    routes: List[List[str]],
    nodes: Dict[str, Node],
    tm: TimeMatrix,
    groups: Dict[str, List[str]],  # <-- TAMBAH INI
) -> Tuple[List[List[str]], float, bool]:
    """
    Relocate satu node 'park' dari posisi A ke posisi B (intra & inter-route).
    VERSI GROUP-AWARE: HANYA memindahkan node yang BUKAN bagian dari split-group.
    """
    best_delta = 0.0
    best: Optional[Tuple[int, int, int]] = None  # (r_from, idx_from, r_to_pos)

    # precompute route costs
    base_costs = [_route_cost(nodes, tm, r) for r in routes]

    for rf, route_f in enumerate(routes):
        # index park dalam route_f (bukan depot di 0 dan bukan depot terakhir)
        idx_parks_f = [
            i for i in range(1, len(route_f) - 1) if nodes[route_f[i]].type == "park"
        ]
        for i in idx_parks_f:
            nid = route_f[i]

            # --- PENGECEKAN GROUP-AWARE ---
            base_id = nid.split("#")[0]
            if base_id in groups:
                continue  # Ini adalah 'part' dari split-group. JANGAN PINDAHKAN.
            # --- AKHIR PENGECEKAN ---

            # coba pindah ke setiap posisi di semua rute (termasuk rute yang sama)
            for rt, route_t in enumerate(routes):
                for j in range(1, len(route_t)):  # sisip sebelum index j
                    # tidak masuk akal sisip di posisi yang sama
                    if rf == rt and (j == i or j == i + 1):
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
                        (
                            _route_cost(nodes, tm, new_routes[k])
                            if k in affected
                            else base_costs[k]
                        )
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
    groups: Dict[str, List[str]],  # <-- TAMBAH INI
) -> Tuple[List[List[str]], float, bool]:
    """
    Tukar dua node 'park' antar posisi (intra & inter-route).
    VERSI GROUP-AWARE: HANYA menukar node yang BUKAN bagian dari split-group.
    """
    best_delta = 0.0
    best = None  # (r1,i1,r2,i2)

    base_costs = [_route_cost(nodes, tm, r) for r in routes]

    for r1, route1 in enumerate(routes):
        idx1 = [i for i in range(1, len(route1) - 1) if nodes[route1[i]].type == "park"]
        for r2 in range(r1, len(routes)):
            route2 = routes[r2]
            idx2 = [
                i for i in range(1, len(route2) - 1) if nodes[route2[i]].type == "park"
            ]
            for i1 in idx1:
                # --- PENGECEKAN GROUP-AWARE (NODE 1) ---
                nid1 = route1[i1]
                base1 = nid1.split("#")[0]
                if base1 in groups:
                    continue  # Node 1 adalah split-part. JANGAN TUKAR.
                # --- AKHIR PENGECEKAN ---

                for i2 in idx2:
                    if r1 == r2 and i1 == i2:
                        continue

                    # --- PENGECEKAN GROUP-AWARE (NODE 2) ---
                    nid2 = route2[i2]
                    base2 = nid2.split("#")[0]
                    if base2 in groups:
                        continue  # Node 2 adalah split-part. JANGAN TUKAR.
                    # --- AKHIR PENGECEKAN ---

                    new_routes = [r[:] for r in routes]
                    new_routes[r1][i1], new_routes[r2][i2] = (
                        new_routes[r2][i2],
                        new_routes[r1][i1],
                    )
                    affected = {r1, r2}
                    new_cost = sum(
                        (
                            _route_cost(nodes, tm, new_routes[k])
                            if k in affected
                            else base_costs[k]
                        )
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


def two_opt_move(
    routes: List[List[str]],
    nodes: Dict[str, Node],
    tm: TimeMatrix,
    groups: Dict[str, List[str]],  # <-- TAMBAH INI
) -> Tuple[List[List[str]], float, bool]:
    """
    2-opt intra-route: pilih dua posisi i<j (bukan depot), balik segmen route[i:j+1].
    VERSI GROUP-AWARE: HANYA membalik segmen yang TIDAK MENGANDUNG split-node.
    """
    best_delta = 0.0
    best: Optional[Tuple[int, int, int]] = None  # (r_idx, i, j)

    base_costs = [_route_cost(nodes, tm, r) for r in routes]
    base_sum = sum(base_costs)

    for r_idx, r in enumerate(routes):
        n = len(r)
        if n <= 4:
            continue  # tidak ada ruang untuk 2-opt

        for i in range(1, n - 2):
            for j in range(i + 1, n - 1):

                # --- PENGECEKAN GROUP-AWARE ---
                # Cek apakah segmen r[i...j] mengandung 'part' dari split-group
                is_illegal = False
                for k in range(i, j + 1):
                    nid_k = r[k]
                    base_k = nid_k.split("#")[0]
                    if base_k in groups:
                        # Segmen ini menyentuh split-group (misal '1#2').
                        # Membaliknya akan merusak urutan (jadi '...1#3,1#2,1#1...')
                        is_illegal = True
                        break
                if is_illegal:
                    continue  # Lewati 'j' ini, coba j+1
                # --- AKHIR PENGECEKAN ---

                # Jika lolos (segmen aman), baru lakukan 2-opt
                new_r = r[:i] + list(reversed(r[i : j + 1])) + r[j + 1 :]
                if new_r == r:
                    continue
                new_routes = [rr[:] for rr in routes]
                new_routes[r_idx] = new_r

                # hitung delta hanya untuk rute yang berubah
                new_cost = base_sum - base_costs[r_idx] + _route_cost(nodes, tm, new_r)
                delta = new_cost - base_sum
                if delta < best_delta - 1e-9:
                    best_delta = delta
                    best = (r_idx, i, j)

    if best is None:
        return routes, 0.0, False

    r_idx, i, j = best
    r = routes[r_idx]
    new_r = r[:i] + list(reversed(r[i : j + 1])) + r[j + 1 :]
    new_routes = [rr[:] for rr in routes]
    new_routes[r_idx] = new_r
    return new_routes, best_delta, True
