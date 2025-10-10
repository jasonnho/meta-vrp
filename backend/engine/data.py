from dataclasses import dataclass
from typing import Dict, List
import pandas as pd
import numpy as np

@dataclass(frozen=True)
class Node:
    id: str
    name: str
    lat: float
    lon: float
    type: str           # 'depot' | 'park' | 'refill'
    demand_liters: float
    service_min: float

class TimeMatrix:
    def __init__(self, ids: List[str], matrix: np.ndarray):
        self.ids = ids
        self.index = {nid: i for i, nid in enumerate(ids)}
        self.M = matrix  # minutes

    def travel(self, a: str, b: str) -> float:
        return float(self.M[self.index[a], self.index[b]])

def load_nodes_csv(path: str) -> Dict[str, Node]:
    df = pd.read_csv(path)
    required = {"id","name","lat","lon","type","demand_liters","service_min"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"nodes.csv missing columns: {missing}")

    nodes: Dict[str, Node] = {}
    for _, r in df.iterrows():
        nid = str(r["id"])
        nodes[nid] = Node(
            id=nid,
            name=str(r["name"]),
            lat=float(r["lat"]),
            lon=float(r["lon"]),
            type=str(r["type"]).lower(),
            demand_liters=float(r["demand_liters"]),
            service_min=float(r["service_min"]),
        )
    if not any(n.type == "depot" for n in nodes.values()):
        raise ValueError("nodes.csv must contain at least one node with type=depot")
    return nodes

def load_time_matrix_csv(path: str, ids_in_order: List[str]) -> TimeMatrix:
    M = pd.read_csv(path, header=None).to_numpy(dtype=float)
    n = len(ids_in_order)
    if M.shape != (n, n):
        raise ValueError(f"time_matrix.csv must be {n}x{n}, got {M.shape}")
    return TimeMatrix(ids_in_order, M)
