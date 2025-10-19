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
    ensure_all_routes_capacity,
)

DestroyOp = Callable[
    [List[List[str]], Dict[str, Node], TimeMatrix, int, Dict[str, List[str]]],
    Tuple[List[str], List[List[str]]],
]
RepairOp = Callable[
    [
        List[List[str]],
        List[str],
        Dict[str, Node],
        TimeMatrix,
        dict,
        Optional[Dict[str, List[str]]],
    ],
    List[List[str]],
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
    groups: Dict[str, List[str]],
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
        secondary = total_time_minutes(routes, nodes, tm)
        return base + 1e-3 * secondary  # epsilon kecil untuk meratakan

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
        removed, partial = d_op(current, nodes, tm, k_remove, groups)
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
                groups,
            )
        repaired, _ins = ensure_all_routes_capacity(
            repaired, nodes, vehicle_capacity, refill_ids, tm, depot_id
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
    groups: Dict[str, List[str]],
) -> Tuple[List[str], List[List[str]]]:
    """
    Random removal (group-aware): pilih beberapa seed park acak,
    lalu hapus SELURUH anggota grupnya.
    """
    # kumpulkan semua park
    parks = []
    for r in routes:
        parks.extend([nid for nid in r[1:-1] if nodes[nid].type == "park"])
    if not parks or k <= 0:
        return [], routes

    # pilih seed acak lalu expand ke seluruh grup sampai >= k part
    random.shuffle(parks)
    removed_set = set()
    for nid in parks:
        base = nid.split("#")[0]
        for p in groups.get(base, [nid]):
            removed_set.add(p)
        if sum(1 for p in removed_set if nodes[p].type == "park") >= k:
            break

    # bangun routes baru tanpa semua part yang terhapus
    new_routes = []
    for r in routes:
        new_r = [
            nid for nid in r if not (nid in removed_set and nodes[nid].type == "park")
        ]
        # jaga depot di ujung
        if new_r and new_r[0] != r[0]:
            new_r.insert(0, r[0])
        if new_r and new_r[-1] != r[-1]:
            new_r.append(r[-1])
        new_routes.append(new_r)

    return list(removed_set), new_routes


def destroy_shaw(
    routes: List[List[str]],
    nodes: Dict[str, Node],
    tm: TimeMatrix,
    k: int,
    groups: Dict[str, List[str]],
) -> Tuple[List[str], List[List[str]]]:
    """
    Shaw removal (group-aware): pilih 1 seed park, urutkan tetangga paling dekat,
    lalu hapus blok-blok grup hingga mencapai ~k part.
    """
    parks = []
    for r in routes:
        parks.extend([nid for nid in r[1:-1] if nodes[nid].type == "park"])
    if not parks or k <= 0:
        return [], routes

    seed = random.choice(parks)

    def proximity(p):
        return tm.travel(seed, p) + tm.travel(p, seed)

    ordered = [p for p in parks if p != seed]
    ordered.sort(key=proximity)

    removed_set = set()
    # mulai dari seed → hapus seluruh grupnya
    for nid in [seed] + ordered:
        base = nid.split("#")[0]
        for part in groups.get(base, [nid]):
            removed_set.add(part)
        if sum(1 for p in removed_set if nodes[p].type == "park") >= k:
            break

    # rebuild routes
    new_routes = []
    for r in routes:
        new_r = [
            nid for nid in r if not (nid in removed_set and nodes[nid].type == "park")
        ]
        if new_r and new_r[0] != r[0]:
            new_r.insert(0, r[0])
        if new_r and new_r[-1] != r[-1]:
            new_r.append(r[-1])
        new_routes.append(new_r)
    return list(removed_set), new_routes


def destroy_worst(
    routes: List[List[str]],
    nodes: Dict[str, Node],
    tm: TimeMatrix,
    k: int,
    groups: Dict[str, List[str]],
) -> Tuple[List[str], List[List[str]]]:
    """
    Worst removal (group-aware): rangking part berdasarkan kontribusi lokal terbesar,
    lalu hapus seluruh grup part tersebut sampai ~k part terhapus.
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

    if not candidates or k <= 0:
        return [], routes

    candidates.sort(key=lambda x: x[1], reverse=True)

    removed_set = set()
    for nid, _, _, _ in candidates:
        base = nid.split("#")[0]
        for part in groups.get(base, [nid]):
            removed_set.add(part)
        if sum(1 for p in removed_set if nodes[p].type == "park") >= k:
            break

    new_routes = []
    for r in routes:
        new_r = [
            nid for nid in r if not (nid in removed_set and nodes[nid].type == "park")
        ]
        if new_r and new_r[0] != r[0]:
            new_r.insert(0, r[0])
        if new_r and new_r[-1] != r[-1]:
            new_r.append(r[-1])
        new_routes.append(new_r)

    return list(removed_set), new_routes


# =========================
# Repair operators
# =========================


from .utils import best_insertion_index_for_node


def repair_greedy(routes, removed, nodes, tm, ctx, groups=None):
    vehicle_capacity = ctx["vehicle_capacity"]
    refill_ids = ctx["refill_ids"]
    allow_refill = ctx["allow_refill"]
    depot_id = ctx["depot_id"]

    current = [r[:] for r in routes]
    # kelompokkan per base
    by_base: Dict[str, List[str]] = {}
    for nid in removed:
        if nodes[nid].type != "park":
            continue
        base = nid.split("#")[0]
        by_base.setdefault(base, [])
        by_base[base].append(nid)
    # sort stabil
    for k in by_base:
        by_base[k].sort()

    for base, parts in by_base.items():
        # pilih rute target terbaik: coba posisi terbaik untuk part pertama pada tiap rute
        best_route = 0
        best_delta = float("inf")
        best_pos = 1
        p0 = parts[0]
        for ri, r in enumerate(current):
            j = best_insertion_index_for_node(r, p0, nodes, tm)
            a, b = r[j - 1], r[j]
            delta = (
                tm.travel(a, p0)
                + tm.travel(p0, b)
                - tm.travel(a, b)
                + nodes[p0].service_min
            )
            if delta < best_delta:
                best_delta = delta
                best_route = ri
                best_pos = j
        # sisipkan semua parts ke rute best_route
        # alns.py (KODE BARU - BENAR)

        # sisipkan semua parts ke rute best_route SEBAGAI SATU BLOK
        tgt = current[best_route]

        # parts sudah di-sort oleh 'by_base', misal: ['1#1', '1#2', '1#3']
        # 'best_pos' adalah posisi terbaik untuk '1#1'.
        # Kita sisipkan seluruh list 'parts' di posisi 'best_pos'.

        # Contoh: tgt = [0, A, B, 0], best_pos = 2
        # Hasil: tgt = [0, A, '1#1', '1#2', '1#3', B, 0]
        tgt[best_pos:best_pos] = parts

        # HAPUS 'for pk in parts[1:]:' ... (loop itu sudah tidak ada)

        # kapasitas safety untuk seluruh solusi (atau minimal rute target)
        current, _ = ensure_all_routes_capacity(
            current, nodes, vehicle_capacity, refill_ids, tm, depot_id
        )

    return current


def repair_regret2(
    routes: List[List[str]],
    removed: List[str],
    nodes: Dict[str, Node],
    tm: TimeMatrix,
    ctx: dict,
    groups: Optional[Dict[str, List[str]]] = None,
) -> List[List[str]]:
    """
    Regret-2 insertion (group-aware):
    - Kelompokkan removed per base_id.
    - Untuk tiap grup, pilih rute target pakai regret-2 berdasarkan anggota pertama.
    - Sisipkan semua anggota grup ke rute target (posisi terbaik per langkah).
    - Setelah tiap grup, jalankan capacity repair.
    """
    from .utils import ensure_all_routes_capacity, best_insertion_index_for_node

    vehicle_capacity = ctx["vehicle_capacity"]
    refill_ids = ctx["refill_ids"]
    depot_id = ctx["depot_id"]

    current = deepcopy_routes(routes)

    # kelompokkan per base
    by_base: Dict[str, List[str]] = {}
    for nid in removed:
        if nodes[nid].type != "park":
            continue
        base = nid.split("#")[0]
        by_base.setdefault(base, [])
        by_base[base].append(nid)
    # sort stabil
    for k in by_base:
        by_base[k].sort()

    # urutan proses grup: boleh acak/urut; di sini urut alfabetis base → stabil
    for base in sorted(by_base.keys()):
        parts = by_base[base]
        p0 = parts[0]

        # hitung dua posisi terbaik untuk p0 di tiap rute
        cand_per_route: List[Tuple[float, float, int, int]] = []  # (d1,d2,ri,j_best)
        for ri, r in enumerate(current):
            deltas = []
            spots = []
            for j in range(1, len(r)):
                a, b = r[j - 1], r[j]
                delta = (
                    tm.travel(a, p0)
                    + tm.travel(p0, b)
                    - tm.travel(a, b)
                    + nodes[p0].service_min
                )
                deltas.append(delta)
                spots.append(j)
            if not deltas:
                continue
            order = sorted(range(len(deltas)), key=lambda idx: deltas[idx])
            d1 = deltas[order[0]]
            j1 = spots[order[0]]
            d2 = deltas[order[1]] if len(order) >= 2 else (d1 + 1e6)
            cand_per_route.append((d1, d2, ri, j1))

        if not cand_per_route:
            # fallback: rute terpendek
            target_ri = min(range(len(current)), key=lambda i: len(current[i]))
            j_best = 1
        else:
            # pilih rute dengan regret terbesar (d2 - d1)
            cand_per_route.sort(key=lambda x: (x[1] - x[0]), reverse=True)
            d1, d2, target_ri, j_best = cand_per_route[0]

        # sisipkan p0
        # alns.py (KODE BARU - BENAR)

        # sisipkan SELURUH GRUP 'parts' di posisi 'j_best'
        tgt = current[target_ri]

        # 'j_best' adalah posisi terbaik untuk 'p0' (anchor)
        # Kita sisipkan seluruh blok 'parts' di sana
        tgt[j_best:j_best] = parts

        # HAPUS 'for pk in parts[1:]:' ... (loop itu sudah tidak ada)

        # perbaiki kapasitas (auto refill)
        current, _ = ensure_all_routes_capacity(
            current, nodes, vehicle_capacity, refill_ids, tm, depot_id
        )

    return current
