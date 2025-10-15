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
