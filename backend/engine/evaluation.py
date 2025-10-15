from typing import Dict, List
from .data import Node, TimeMatrix


def route_time_minutes(
    route: List[str], nodes: Dict[str, Node], tm: TimeMatrix
) -> float:
    """Total travel + service time (menit) untuk satu rute."""
    if len(route) < 2:
        return 0.0
    total = 0.0
    for i in range(len(route) - 1):
        a, b = route[i], route[i + 1]
        total += tm.travel(a, b)
        # service time di node tujuan (kecuali kita bisa abaikan depot akhir jika mau)
        total += nodes[b].service_min
    return total


def total_time_minutes(
    routes: List[List[str]], nodes: Dict[str, Node], tm: TimeMatrix
) -> float:
    return sum(route_time_minutes(r, nodes, tm) for r in routes if len(r) > 1)


def load_profile_liters(
    route: List[str], nodes: Dict[str, Node], vehicle_capacity: float
) -> List[float]:
    """Sisa kapasitas setelah mengunjungi tiap node dalam route (mulai dari depot)."""
    rem = vehicle_capacity
    profile: List[float] = []
    for nid in route:
        n = nodes[nid]
        if n.type == "refill":
            rem = vehicle_capacity
        elif n.type == "park":
            rem -= n.demand_liters
            if rem < 0:
                # boleh negatif kalau nanti kamu pakai penalti; untuk baseline, clamp ke 0
                rem = 0.0
        profile.append(rem)
    return profile


def makespan_minutes(routes, nodes, tm):
    if not routes:
        return 0.0
    per_route = [route_time_minutes(r, nodes, tm) for r in routes if len(r) > 1]
    return max(per_route) if per_route else 0.0
