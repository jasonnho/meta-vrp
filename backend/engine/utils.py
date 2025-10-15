# utils.py
from __future__ import annotations
import random
import hashlib
from collections import deque
from typing import Iterable, List, Any
import math


def set_seed(seed: int) -> None:
    random.seed(seed)


def deepcopy_routes(routes: List[List[str]]) -> List[List[str]]:
    return [r[:] for r in routes]


def hash_routes(routes: List[List[str]]) -> str:
    """Hash rute untuk identitas solusi (bisa dipakai Tabu solusi)."""
    s = "|".join(["-".join(r) for r in routes])
    return hashlib.md5(s.encode("utf-8")).hexdigest()


def weighted_choice(weights: List[float]) -> int:
    """Roulette-wheel selection; return index berdasarkan bobot."""
    total = sum(weights)
    if total <= 0:
        # fallback: seragam
        return random.randrange(len(weights))
    r = random.uniform(0, total)
    acc = 0.0
    for i, w in enumerate(weights):
        acc += w
        if r <= acc:
            return i
    return len(weights) - 1


class SimulatedAnnealing:
    """SA acceptance sederhana (Metropolis)."""

    def __init__(self, T: float, alpha: float, Tmin: float):
        self.T = T
        self.alpha = alpha
        self.Tmin = Tmin

    def accept(self, delta: float) -> bool:
        # delta > 0 adalah perburukan
        if self.T <= 1e-12:
            return False
        prob = math.exp(-delta / max(self.T, 1e-12))
        return random.random() < prob

    def cool(self) -> None:
        self.T = max(self.Tmin, self.T * self.alpha)


class TabuList:
    """
    Tabu list sederhana.
    Mode 1: simpan hash solusi (gunakan add(hash_routes(routes))).
    Mode 2: simpan set node yang baru di-remove (pakai add_many([...])) dan cek contains_any([...]).
    """

    def __init__(self, maxlen: int = 20):
        self.maxlen = maxlen
        self.q = deque([], maxlen=maxlen)
        self.set_ = set()

    def add(self, item: Any) -> None:
        if len(self.q) == self.maxlen:
            old = self.q[0]
            self.set_.discard(old)
        self.q.append(item)
        self.set_.add(item)

    def add_many(self, items: Iterable[Any]) -> None:
        for it in items:
            self.add(it)

    def contains(self, item: Any) -> bool:
        return item in self.set_

    def contains_any(self, items: Iterable[Any]) -> bool:
        for it in items:
            if it in self.set_:
                return True
        return False


# utils.py (tambahkan)
from typing import List, Dict, Tuple
from .data import Node, TimeMatrix


def _nearest_refill_delta(
    prev_id: str, park_id: str, refill_ids: List[str], tm: TimeMatrix
) -> str:
    """Pilih refill r yang meminimalkan delta travel lokal (prev->r->park vs prev->park)."""
    best_r = None
    best_delta = float("inf")
    for r in refill_ids:
        delta = (
            tm.travel(prev_id, r) + tm.travel(r, park_id) - tm.travel(prev_id, park_id)
        )
        if delta < best_delta:
            best_delta = delta
            best_r = r
    return best_r  # type: ignore


def ensure_capacity_with_refills(
    route: List[str],
    nodes: Dict[str, Node],
    vehicle_capacity: float,
    refill_ids: List[str],
    tm: TimeMatrix,
    depot_id: str,
) -> Tuple[List[str], int]:
    """
    Scan rute kiri→kanan. Jika ketemu park yang butuh > sisa rem, sisipkan refill terdekat tepat sebelum park tsb.
    Kembalikan (route_fixed, n_refill_inserted).
    """
    if not route or len(route) <= 2:
        return route[:], 0

    fixed = route[:]  # copy
    inserted = 0

    i = 0
    rem = 0
    while i < len(fixed):
        nid = fixed[i]
        n = nodes[nid]

        if n.type == "refill":
            rem = vehicle_capacity
            # (optional) kalau mau, masih boleh buang refill berurutan persis yang sama,
            # tapi JANGAN pernah buang refill di posisi 1 (setelah depot).
            i += 1
            continue

        if n.type == "park":
            if n.demand_liters > rem:
                # perlu refill sebelum park ini
                if not refill_ids:
                    # tidak bisa diperbaiki
                    i += 1
                    continue
                prev_id = fixed[i - 1] if i > 0 else depot_id
                r = _nearest_refill_delta(prev_id, nid, refill_ids, tm)
                if r is None:
                    i += 1
                    continue
                fixed.insert(i, r)
                rem = vehicle_capacity  # reset setelah refill
                inserted += 1
                # Jangan maju index; evaluasi park yang sama lagi
                continue
            else:
                rem -= n.demand_liters
        # depot: biarkan
        i += 1

    # Bersihkan refill duplikat berurutan
    j = 1
    while j < len(fixed):
        if nodes[fixed[j]].type == "refill" and fixed[j] == fixed[j - 1]:
            fixed.pop(j)
        else:
            j += 1

    # Trim refill di [depot, ...] dan [..., depot]
    if len(fixed) >= 3 and fixed[-1] == depot_id and nodes[fixed[-2]].type == "refill":
        fixed.pop(-2)

    return fixed, inserted


def ensure_all_routes_capacity(
    routes: List[List[str]],
    nodes: Dict[str, Node],
    vehicle_capacity: float,
    refill_ids: List[str],
    tm: TimeMatrix,
    depot_id: str,
) -> Tuple[List[List[str]], int]:
    """Apply ensure_capacity_with_refills ke semua rute. Return (routes_fixed, total_refills_inserted)."""
    total_ins = 0
    out = []
    for r in routes:
        rr, ins = ensure_capacity_with_refills(
            r, nodes, vehicle_capacity, refill_ids, tm, depot_id
        )
        out.append(rr)
        total_ins += ins
    return out, total_ins
