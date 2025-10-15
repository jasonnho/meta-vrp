# alns.py
from __future__ import annotations
import math
import random
import time
from typing import Dict, List, Tuple, Callable, Optional
from dataclasses import dataclass

from .data import Node, TimeMatrix
from .evaluation import total_time_minutes, makespan_minutes
from .construct import greedy_construct
from .utils import (
    set_seed,
    deepcopy_routes,
    hash_routes,
    SimulatedAnnealing,
    TabuList,
    weighted_choice,
)

DestroyOp = Callable[
    [List[List[str]], Dict[str, Node], TimeMatrix, int],
    Tuple[List[str], List[List[str]]],
]
RepairOp = Callable[
    [List[List[str]], List[str], Dict[str, Node], TimeMatrix, dict], List[List[str]]
]


@dataclass
class ALNSConfig:
    time_limit_sec: float = 8.0
    seed: int = 42

    # SA acceptance
    init_temperature: float = 1_000.0
    cooling_rate: float = 0.995  # geometric
    min_temperature: float = 1e-3

    # destroy/repair params
    k_remove_min: int = 2
    k_remove_max: int = 8

    # adaptive weights
    w_improve: float = 5.0
    w_accept: float = 2.0
    w_reject: float = 0.5
    score_update_period: int = 25

    # tabu
    tabu_tenure: int = 20
    use_tabu_on_removed_nodes: bool = True

    # feasibility/penalty (opsional)
    lambda_capacity: float = 0.0  # set >0 kalau mau penalti kapasitas

    # repair strategy
    use_construct_as_repair: bool = (
        False  # bisa toggle pakai greedy_construct sebagai repair alternatif
    )


def alns_optimize(
    init_routes: List[List[str]],
    nodes: Dict[str, Node],
    tm: TimeMatrix,
    vehicle_capacity: float,
    refill_ids: List[str],
    depot_id: str,
    allow_refill: bool,
    cfg: Optional[ALNSConfig] = None,
) -> List[List[str]]:
    """
    Core ALNS loop: Destroy → Repair → Acceptance → Adaptation.
    - init_routes: solusi awal (mis. dari greedy_construct)
    - returns: solusi terbaik menurut objective (total_time_minutes + optional penalti)
    """
    cfg = cfg or ALNSConfig()
    set_seed(cfg.seed)

    # --- operator pools ---
    destroy_ops: List[Tuple[str, DestroyOp]] = [
        ("random_removal", destroy_random),
        ("shaw_removal", destroy_shaw),
        ("worst_removal", destroy_worst),
    ]
    repair_ops: List[Tuple[str, RepairOp]] = [
        ("greedy_insert", repair_greedy),
        ("regret2_insert", repair_regret2),
    ]

    # adaptive weights & scores
    d_weights = [1.0] * len(destroy_ops)
    r_weights = [1.0] * len(repair_ops)
    d_scores = [0.0] * len(destroy_ops)
    r_scores = [0.0] * len(repair_ops)
    d_uses = [1e-9] * len(destroy_ops)  # hindari div/0
    r_uses = [1e-9] * len(repair_ops)

    # acceptance
    sa = SimulatedAnnealing(
        T=cfg.init_temperature, alpha=cfg.cooling_rate, Tmin=cfg.min_temperature
    )

    # tabu
    tabu = TabuList(maxlen=cfg.tabu_tenure)

    # objective helper
    def objective(routes: List[List[str]]) -> float:
        # Pakai makespan biar mesin terdorong pakai banyak kendaraan (selesai lebih cepat)
        base = makespan_minutes(routes, nodes, tm)
        # Selalu inisialisasi overload agar tidak UnboundLocalError
        overload = 0.0
        # kalau nanti mau penalti kapasitas beneran, hitung overload total di sini
        # if cfg.lambda_capacity > 0:
        #     overload = compute_total_overload(routes, nodes, vehicle_capacity, refill_ids)
        return base + cfg.lambda_capacity * overload

    # init
    best = deepcopy_routes(init_routes)
    best_cost = objective(best)
    current = deepcopy_routes(best)
    current_cost = best_cost

    start = time.time()
    it = 0

    while time.time() - start < cfg.time_limit_sec and sa.T > sa.Tmin:
        it += 1

        # --- pilih operator (roulette by weight) ---
        di = weighted_choice(d_weights)
        ri = weighted_choice(r_weights)
        d_name, d_op = destroy_ops[di]
        r_name, r_op = repair_ops[ri]

        # --- tentukan k (berapa node di-remove) ---
        k_remove = random.randint(cfg.k_remove_min, cfg.k_remove_max)

        # --- DESTROY ---
        removed, partial = d_op(current, nodes, tm, k_remove)
        if cfg.use_tabu_on_removed_nodes and tabu.contains_any(removed):
            # destroy ini menghasilkan set yg tabu → skip
            continue

        # --- REPAIR ---
        if cfg.use_construct_as_repair:
            # jalur alternatif: pakai construct sebagai repair (treat 'removed' sebagai selected_parks)
            # NOTE: ini me-reset semua rute; biasanya kurang halus tapi kadang berguna
            repaired = greedy_construct(
                nodes=nodes,
                tm=tm,
                selected_parks=[p for p in removed if nodes[p].type == "park"],
                depot_id=depot_id,
                num_vehicles=len(partial),  # pakai jumlah rute eksisting
                vehicle_capacity=vehicle_capacity,
                allow_refill=allow_refill,
                refill_ids=refill_ids,
            )
        else:
            # repair internal (greedy / regret)
            repaired = r_op(
                partial,
                removed,
                nodes,
                tm,
                {
                    "vehicle_capacity": vehicle_capacity,
                    "refill_ids": refill_ids,
                    "allow_refill": allow_refill,
                    "depot_id": depot_id,
                },
            )

        new_cost = objective(repaired)
        delta = new_cost - current_cost

        # --- acceptance ---
        accepted = False
        if delta <= 0:
            accepted = True
        else:
            accepted = sa.accept(delta)

        if accepted:
            current = repaired
            current_cost = new_cost
            # update best
            if new_cost < best_cost - 1e-9:
                best = deepcopy_routes(repaired)
                best_cost = new_cost
                # reward improve
                d_scores[di] += cfg.w_improve
                r_scores[ri] += cfg.w_improve
            else:
                # reward accepted (non-improving)
                d_scores[di] += cfg.w_accept
                r_scores[ri] += cfg.w_accept

            # update tabu dengan node yang baru di-remove (opsional)
            if cfg.use_tabu_on_removed_nodes:
                tabu.add_many(removed)

        else:
            # rejected move
            d_scores[di] += cfg.w_reject
            r_scores[ri] += cfg.w_reject

        d_uses[di] += 1
        r_uses[ri] += 1

        # --- adapt weights berkala ---
        if it % cfg.score_update_period == 0:
            for i in range(len(d_weights)):
                d_weights[i] = max(1e-3, d_weights[i] * (1.0 + d_scores[i] / d_uses[i]))
                d_scores[i] = 0.0
                d_uses[i] = 1e-9
            for i in range(len(r_weights)):
                r_weights[i] = max(1e-3, r_weights[i] * (1.0 + r_scores[i] / r_uses[i]))
                r_scores[i] = 0.0
                r_uses[i] = 1e-9

        # cool down
        sa.cool()

    return best


# =========================
# Destroy operators
# =========================


def destroy_random(
    routes: List[List[str]],
    nodes: Dict[str, Node],
    tm: TimeMatrix,
    k: int,
) -> Tuple[List[str], List[List[str]]]:
    """
    Hapus k node 'park' acak. Kembalikan (removed_nodes, partial_routes).
    """
    parks = []
    for r in routes:
        parks.extend([nid for nid in r[1:-1] if nodes[nid].type == "park"])
    k = min(k, len(parks))
    removed = set(random.sample(parks, k)) if k > 0 else set()

    new_routes = []
    for r in routes:
        new_r = [nid for nid in r if nid not in removed or nodes[nid].type != "park"]
        # pastikan depot tetap di ujung
        if new_r[0] != r[0]:
            new_r.insert(0, r[0])
        if new_r[-1] != r[-1]:
            new_r.append(r[-1])
        new_routes.append(new_r)
    return list(removed), new_routes


def destroy_shaw(
    routes: List[List[str]],
    nodes: Dict[str, Node],
    tm: TimeMatrix,
    k: int,
) -> Tuple[List[str], List[List[str]]]:
    """
    Shaw removal: pilih satu seed park, lalu hapus tetangga dekat (berdasar jarak/waktu).
    """
    parks = []
    for r in routes:
        parks.extend([nid for nid in r[1:-1] if nodes[nid].type == "park"])
    if not parks:
        return [], routes

    seed = random.choice(parks)

    # skor kemiripan = travel time yang kecil → lebih 'mirip'
    def proximity(p):
        return tm.travel(seed, p) + tm.travel(p, seed)

    ordered = sorted([p for p in parks if p != seed], key=proximity)
    removed = [seed] + ordered[: max(0, k - 1)]
    # hapus dari rute
    new_routes = []
    rem_set = set(removed)
    for r in routes:
        new_r = [nid for nid in r if not (nid in rem_set and nodes[nid].type == "park")]
        if new_r[0] != r[0]:
            new_r.insert(0, r[0])
        if new_r[-1] != r[-1]:
            new_r.append(r[-1])
        new_routes.append(new_r)
    return removed, new_routes


def destroy_worst(
    routes: List[List[str]],
    nodes: Dict[str, Node],
    tm: TimeMatrix,
    k: int,
) -> Tuple[List[str], List[List[str]]]:
    """
    Worst removal: hapus park dengan kontribusi biaya lokal tertinggi.
    Aproksimasi kontribusi: (a->p + p->b - a->b) + service(p).
    """
    candidates: List[Tuple[str, float, int, int]] = []  # (nid, score, r_idx, pos)
    for ri, r in enumerate(routes):
        for i in range(1, len(r) - 1):
            nid = r[i]
            if nodes[nid].type != "park":
                continue
            a, b = r[i - 1], r[i + 1]
            score = (
                tm.travel(a, nid)
                + tm.travel(nid, b)
                - tm.travel(a, b)
                + nodes[nid].service_min
            )
            candidates.append((nid, score, ri, i))
    candidates.sort(key=lambda x: x[1], reverse=True)
    removed = set()
    marks = set()
    for nid, _, ri, i in candidates:
        if len(removed) >= k:
            break
        if (ri, i) in marks:
            continue
        removed.add(nid)
        marks.add((ri, i))

    new_routes = []
    for r in routes:
        new_r = [nid for nid in r if not (nid in removed and nodes[nid].type == "park")]
        if new_r[0] != r[0]:
            new_r.insert(0, r[0])
        if new_r[-1] != r[-1]:
            new_r.append(r[-1])
        new_routes.append(new_r)
    return list(removed), new_routes


# =========================
# Repair operators
# =========================


def repair_greedy(
    routes: List[List[str]],
    removed: List[str],
    nodes: Dict[str, Node],
    tm: TimeMatrix,
    ctx: dict,
) -> List[List[str]]:
    """
    Sisipkan node secara greedy di posisi dengan delta biaya minimal.
    TODO: jika kapasitas terlanggar, selipkan refill (bila diizinkan).
    """
    vehicle_capacity = ctx["vehicle_capacity"]
    refill_ids = ctx["refill_ids"]
    allow_refill = ctx["allow_refill"]

    current = deepcopy_routes(routes)
    parks = [nid for nid in removed if nodes[nid].type == "park"]

    for p in parks:
        best_delta = float("inf")
        best_where: Optional[Tuple[int, int]] = None  # (r_idx, pos)

        for ri, r in enumerate(current):
            # coba sisip di antara (j-1, j)
            for j in range(1, len(r)):  # sisip sebelum j
                a, b = r[j - 1], r[j]
                delta = (
                    tm.travel(a, p)
                    + tm.travel(p, b)
                    - tm.travel(a, b)
                    + nodes[p].service_min
                )

                # TODO: cek kapasitas r setelah sisip p; jika overload dan allow_refill,
                # coba sisip refill di sekitar posisi yang memberi delta minimal.
                # Jika tidak feasible dan tak bisa diperbaiki, skip kandidat ini.

                if delta < best_delta:
                    best_delta = delta
                    best_where = (ri, j)

        if best_where is None:
            # fallback: buat rute baru (jika diperbolehkan) - tapi di baseline kita pertahankan jumlah rute
            # di sini kita masukkan ke rute dengan depot saja (terpendek)
            lens = [(ri, len(r)) for ri, r in enumerate(current)]
            ri = min(lens, key=lambda x: x[1])[0]
            current[ri].insert(1, p)
        else:
            ri, j = best_where
            current[ri].insert(j, p)

    return current


def repair_regret2(
    routes: List[List[str]],
    removed: List[str],
    nodes: Dict[str, Node],
    tm: TimeMatrix,
    ctx: dict,
) -> List[List[str]]:
    """
    Regret-2 insertion: pilih node dengan (delta2 - delta1) terbesar, lalu sisip di posisi terbaiknya.
    TODO: tambahkan feasibilitas kapasitas + sisip refill jika perlu.
    """
    vehicle_capacity = ctx["vehicle_capacity"]
    refill_ids = ctx["refill_ids"]
    allow_refill = ctx["allow_refill"]

    current = deepcopy_routes(routes)
    parks = [nid for nid in removed if nodes[nid].type == "park"]

    while parks:
        # hitung 2 posisi terbaik untuk tiap p
        best_info = []
        for p in parks:
            deltas = []
            spots = []
            for ri, r in enumerate(current):
                for j in range(1, len(r)):
                    a, b = r[j - 1], r[j]
                    delta = (
                        tm.travel(a, p)
                        + tm.travel(p, b)
                        - tm.travel(a, b)
                        + nodes[p].service_min
                    )

                    # TODO: cek kapasitas+refill feasibility; jika tidak feasible → continue

                    deltas.append(delta)
                    spots.append((ri, j))
            if deltas:
                order = sorted(range(len(deltas)), key=lambda idx: deltas[idx])
                d1 = deltas[order[0]]
                s1 = spots[order[0]]
                d2 = deltas[order[1]] if len(order) >= 2 else (d1 + 1e6)
                best_info.append((p, (d2 - d1), d1, s1))
        if not best_info:
            # kalau tidak ada posisi feasible, masukkan secara paksa ke rute terpendek (TODO: repair refill)
            p = parks.pop()
            ri = min(range(len(current)), key=lambda i: len(current[i]))
            current[ri].insert(1, p)
            continue

        # pilih p dengan regret terbesar
        best_info.sort(key=lambda x: x[1], reverse=True)
        p, _, d1, (ri, j) = best_info[0]
        current[ri].insert(j, p)
        parks.remove(p)

    return current
