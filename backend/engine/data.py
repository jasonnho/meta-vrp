from dataclasses import dataclass
from typing import Dict, List, Tuple  # ⬅️ tambah Tuple

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class Node:
    id: str
    name: str
    lat: float
    lon: float
    type: str  # 'depot' | 'park' | 'refill'
    demand_liters: float
    service_min: float


class TimeMatrix:
    def __init__(self, ids: List[str], matrix: np.ndarray):
        self.ids = ids
        self.index = {nid: i for i, nid in enumerate(ids)}
        self.M = matrix  # minutes

    def travel(self, a: str, b: str) -> float:
        return float(self.M[self.index[a], self.index[b]])


def load_nodes_csv(
    path: str,
) -> Tuple[Dict[str, Node], List[str]]:  # ⬅️ return ids_in_order juga
    df = pd.read_csv(path)
    required = {"id", "name", "lat", "lon", "type", "demand_liters", "service_min"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"nodes.csv missing columns: {missing}")

    nodes: Dict[str, Node] = {}
    ids_in_order: List[str] = []

    for _, r in df.iterrows():
        nid = str(r["id"]).strip()  # ⬅️ jadikan string + trim
        ntype = str(r["type"]).strip().lower()  # ⬅️ trim + lower
        node = Node(
            id=nid,
            name=str(r["name"]).strip(),
            lat=float(r["lat"]),
            lon=float(r["lon"]),
            type=ntype,
            demand_liters=float(r["demand_liters"]),
            service_min=float(r["service_min"]),
        )
        nodes[nid] = node
        ids_in_order.append(nid)

    if not any(n.type == "depot" for n in nodes.values()):
        raise ValueError("nodes.csv must contain at least one node with type=depot")

    return nodes, ids_in_order


def load_time_matrix_csv(path: str, ids_in_order: List[str]) -> TimeMatrix:
    M = pd.read_csv(path, header=None).to_numpy(dtype=float)
    n = len(ids_in_order)
    if M.shape != (n, n):
        raise ValueError(f"time_matrix.csv must be {n}x{n}, got {M.shape}")
    return TimeMatrix(ids_in_order, M)
