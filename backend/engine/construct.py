from typing import Dict, List, Set
from .data import Node, TimeMatrix

def _nearest(target_from: str, candidates: List[str], tm: TimeMatrix) -> str:
    best = None
    best_t = float("inf")
    for c in candidates:
        t = tm.travel(target_from, c)
        if t < best_t:
            best, best_t = c, t
    return best  # asumsi candidates tidak kosong

def greedy_construct(
    nodes: Dict[str, Node],
    tm: TimeMatrix,
    selected_parks: List[str],
    depot_id: str,
    num_vehicles: int,
    vehicle_capacity: float,
    allow_refill: bool,
    refill_ids: List[str],
) -> List[List[str]]:
    """
    Baseline: untuk tiap kendaraan, berangkat dari depot, pilih park terdekat yang masih feasible,
    kalau kapasitas kurang dan refill diizinkan → singgah refill terdekat, lanjut lagi.
    """
    unserved: Set[str] = {p for p in selected_parks if nodes[p].type == "park"}
    routes: List[List[str]] = []

    for _ in range(num_vehicles):
        route = [depot_id]
        cur = depot_id
        rem = vehicle_capacity

        while unserved:
            # kandidat park yang muat dengan sisa kapasitas
            feasible = [p for p in unserved if nodes[p].demand_liters <= rem]
            if feasible:
                nxt = _nearest(cur, feasible, tm)
                route.append(nxt)
                rem -= nodes[nxt].demand_liters
                cur = nxt
                unserved.remove(nxt)
                continue

            # tidak ada yang feasible dengan sisa kapasitas → coba refill
            if allow_refill and refill_ids:
                r = _nearest(cur, refill_ids, tm)
                route.append(r)
                cur = r
                rem = vehicle_capacity  # reset
                continue

            # tidak bisa lanjut (tidak ada refill atau refill tidak diizinkan) → akhiri rute ini
            break

        route.append(depot_id)
        routes.append(route)
        if not unserved:
            break

    # jika masih ada unserved sesudah semua kendaraan dipakai, masukkan sisa ke rute terakhir dengan refill-berulang (fallback)
    if unserved and routes:
        route = routes[-1][:-1]  # buang depot akhir
        cur = route[-1] if route else depot_id
        rem = vehicle_capacity  # asumsi terakhir bisa isi penuh dulu (sederhana)
        while unserved:
            need = _nearest(cur, list(unserved), tm)
            d = nodes[need].demand_liters
            if d > rem:
                if allow_refill and refill_ids:
                    r = _nearest(cur, refill_ids, tm)
                    route.append(r)
                    cur = r
                    rem = vehicle_capacity
                    continue
                else:
                    # tidak bisa layani semua; keluar
                    break
            route.append(need)
            cur = need
            rem -= d
            unserved.remove(need)
        route.append(depot_id)
        routes[-1] = route

    return routes
