from typing import Dict, List, Set
from .data import Node, TimeMatrix


def _nearest(target_from: str, candidates: List[str], tm: TimeMatrix) -> str:
    if not candidates:
        raise ValueError("nearest(): candidates must be non-empty")

    # inisialisasi dari elemen pertama → hindari None
    best = candidates[0]
    best_t = tm.travel(target_from, best)

    for c in candidates[1:]:
        t = tm.travel(target_from, c)
        if t < best_t:
            best, best_t = c, t

    return best


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
    # --- VALIDASI KERAS: tidak dukung split-delivery per park ---
    unserved: Set[str] = {p for p in selected_parks if nodes[p].type == "park"}
    if not unserved:
        return [[depot_id, depot_id] for _ in range(max(1, num_vehicles))][:1]

    # Jika ada satu saja demand > kapasitas → tidak mungkin diservis oleh model ini
    too_big = [p for p in unserved if nodes[p].demand_liters > vehicle_capacity]
    if too_big:
        raise RuntimeError(
            f"Park demand exceeds vehicle capacity (no split-delivery). "
            f"Offending ids={too_big[:5]} (truncated), capacity={vehicle_capacity}"
        )

    routes: List[List[str]] = []

    for _ in range(num_vehicles):
        route = [depot_id]
        cur = depot_id
        rem = 0

        # Stall guard untuk jaga-jaga
        MAX_ITERS = 1_000_000
        iters = 0

        while unserved:
            iters += 1
            if iters > MAX_ITERS:
                raise RuntimeError(
                    "greedy_construct: iteration cap reached (possible infinite loop)"
                )

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
                # Jika sudah 'penuh' DAN sedang berada di refill, namun tetap tidak ada yang feasible,
                # berhenti agar tidak loop refill→refill.
                if rem == vehicle_capacity and cur in refill_ids:
                    # Tidak ada kandidat walau sudah penuh → hentikan rute ini
                    break

                r = _nearest(cur, refill_ids, tm)
                if r != cur:
                    route.append(r)
                    cur = r
                # "isi penuh" (walau r==cur, jangan tambah node duplikat)
                rem = vehicle_capacity
                continue

            # tidak bisa lanjut (tidak ada refill atau refill tidak diizinkan) → akhiri rute ini
            break

        route.append(depot_id)
        routes.append(route)
        if not unserved:
            break

    # Fallback: jika masih ada unserved, masukkan ke rute terakhir dengan logika refill.
    # Berkat validasi di atas (demand <= capacity), ini tidak akan loop.
    if unserved and routes:
        route = routes[-1][:-1]  # buang depot akhir
        cur = route[-1] if route else depot_id
        rem = vehicle_capacity  # diasumsikan isi penuh dulu
        MAX_ITERS = 1_000_000
        iters = 0

        while unserved:
            iters += 1
            if iters > MAX_ITERS:
                raise RuntimeError("greedy_construct(fallback): iteration cap reached")

            need = _nearest(cur, list(unserved), tm)
            d = nodes[need].demand_liters

            if d > rem:
                if allow_refill and refill_ids:
                    # Jika sudah penuh dan di refill tetapi tetap tidak feasible → break
                    if rem == vehicle_capacity and cur in refill_ids:
                        break
                    r = _nearest(cur, refill_ids, tm)
                    if r != cur:
                        route.append(r)
                        cur = r
                    rem = vehicle_capacity
                    continue
                else:
                    break

            route.append(need)
            cur = need
            rem -= d
            unserved.remove(need)

        route.append(depot_id)
        routes[-1] = route

    return routes
