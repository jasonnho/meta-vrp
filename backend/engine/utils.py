# utils.py
from __future__ import annotations
import random
import hashlib
from collections import deque
from typing import Iterable, List, Any
import math
from .data import Node, TimeMatrix


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

    # Asumsi mulai dari depot (indeks 0) dengan muatan 0
    rem = 0.0

    i = 0
    while i < len(fixed):
        nid = fixed[i]
        # Pastikan node ada di data, jika tidak, lewati
        n = nodes.get(nid)
        if not n:
            i += 1
            continue

        if n.type == "refill":
            rem = vehicle_capacity
            i += 1
            continue

        if n.type == "park":
            # Cek apakah demand > sisa muatan.
            # (Asumsi dari app.py: n.demand_liters <= vehicle_capacity)
            if n.demand_liters > (rem + 1e-9):  # tambah toleransi float
                # Perlu refill sebelum park ini
                if not refill_ids:
                    # Tidak bisa diperbaiki
                    i += 1
                    continue

                prev_id = fixed[i - 1] if i > 0 else depot_id
                prev_node = nodes.get(prev_id)

                # *** PENTING: Cek apakah sebelumnya SUDAH refill ***
                if prev_node and prev_node.type == "refill":
                    # Ini adalah error data (demand taman > kapasitas)
                    # Kita tidak bisa fix, lewati saja park ini.
                    i += 1
                    continue

                r = _nearest_refill_delta(prev_id, nid, refill_ids, tm)
                if r is None:
                    i += 1
                    continue

                fixed.insert(i, r)
                rem = vehicle_capacity  # reset setelah refill
                inserted += 1

                # Jangan maju index (i += 1);
                # biarkan loop while memproses refill yg baru disisipkan (di index i),
                # lalu di loop berikutnya memproses ulang park ini (di index i+1).
                continue
            else:
                # Muatan cukup
                rem -= n.demand_liters

        # node adalah depot atau park yg sukses dilayani
        i += 1

    # === PERBAIKAN DARI SEBELUMNYA (Refill -> Refill) ===
    # Bersihkan refill berurutan (Refill -> Refill), APAPUN ID-nya
    j = 1
    while j < len(fixed):
        # Cek apakah node ini DAN node sebelumnya adalah refill
        node_j = nodes.get(fixed[j])
        node_prev = nodes.get(fixed[j - 1])

        if (
            node_j
            and node_j.type == "refill"
            and node_prev
            and node_prev.type == "refill"
        ):
            # Ada Refill -> Refill (misal 82 -> 85)
            # Buang node INI (yang kedua, di index j)
            fixed.pop(j)
            # Jangan increment j, kita perlu cek lagi di posisi j yg baru
        else:
            j += 1
    # === AKHIR PERBAIKAN Refill -> Refill ===

    # === PERBAIKAN ERROR PYLANCE DI SINI ===
    # Trim refill di [..., depot]
    if len(fixed) >= 3 and fixed[-1] == depot_id:
        # Akses node nya dulu, baru cek type nya
        node_before_depot = nodes.get(fixed[-2])
        if node_before_depot and node_before_depot.type == "refill":
            fixed.pop(-2)

    # (Opsional) Trim refill di [depot, ...]
    if len(fixed) >= 3 and fixed[0] == depot_id:
        # Akses node nya dulu, baru cek type nya
        node_after_depot = nodes.get(fixed[1])
        if node_after_depot and node_after_depot.type == "refill":
            # Asumsi KOSONG (rem=0.0 di atas): JANGAN HAPUS
            pass
    # === AKHIR PERBAIKAN PYLANCE ===

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


def build_groups_from_expanded_ids(
    selected_expanded: List[str],
) -> Tuple[Dict[str, List[str]], Dict[str, str]]:
    """
    Dari id yang sudah di-expand (mis. '25#1','25#2','14'), bangun:
      - groups: {'25': ['25#1','25#2'], '14': ['14']}   (park non-split tetap 1 anggota)
      - part_to_group: {'25#1': '25', '25#2': '25', '14': '14'}
    """
    groups: Dict[str, List[str]] = {}
    part_to_group: Dict[str, str] = {}
    for sid in selected_expanded:
        base = sid.split("#")[0]
        groups.setdefault(base, []).append(sid)
        part_to_group[sid] = base
    # urutkan anggota tiap grup supaya stabil
    for k in groups:
        groups[k].sort()
    return groups, part_to_group


# Di utils.py (Perbaikan untuk AttributeError di line 289)

# Fungsi ensure_all_routes_capacity dan _nearest_refill_delta tidak berubah
# ... (kode fungsi lain) ...


def ensure_groups_single_vehicle(
    routes: List[List[str]],
    groups: Dict[str, List[str]],
    nodes: Dict[str, Node],
    tm: TimeMatrix,
    depot_id: str,
    vehicle_capacity: float,
    refill_ids: List[str],
) -> List[List[str]]:
    """
    Memastikan semua anggota grup (split-node) ada di rute yang sama,
    berurutan (contiguous), dan sesuai urutan sequence (part 1, 2, 3).
    Versi ini memperbaiki bug duplikat visit & AttributeError.
    """
    new_routes = [r[:] for r in routes]
    # Map untuk melacak lokasi sementara: part_id -> route_idx
    part_location: Dict[str, int] = {}
    for ri, r in enumerate(new_routes):
        for node_id in r:
            # --- PERBAIKAN ATTRIBUTE ERROR DI SINI ---
            node_obj = nodes.get(node_id)  # Ambil objek Node dulu
            # Cek apakah node_obj ada, punya '#' di ID, dan tipenya 'park'
            if node_obj and "#" in node_id and node_obj.type == "park":
                part_location[node_id] = ri
            # --- AKHIR PERBAIKAN ---

    processed_bases = set()  # Hindari proses base yang sama dua kali

    for base, parts in groups.items():
        if len(parts) <= 1 or base in processed_bases:
            continue

        processed_bases.add(base)
        parts_set = set(parts)  # Untuk lookup cepat

        # 1. Tentukan rute target (berdasarkan part pertama atau part mana saja yang ditemukan)
        target_route_idx = -1
        anchor_part_for_pos = None  # Part yg akan kita cari posisinya

        # Cari dulu berdasarkan anchor asli (parts[0])
        if parts[0] in part_location:
            target_route_idx = part_location[parts[0]]
            anchor_part_for_pos = parts[0]
        else:
            # Jika anchor tidak ada, cari part lain dari grup yg sama
            found_other = False
            for p in parts[1:]:
                if p in part_location:
                    target_route_idx = part_location[p]
                    # Kita tetap butuh anchor asli untuk menentukan urutan sisip
                    anchor_part_for_pos = parts[0]
                    found_other = True
                    break  # Ambil rute dari part pertama yg ditemukan
            if not found_other:
                continue  # Grup ini tidak ada di solusi

        if target_route_idx == -1:  # Double check, seharusnya tidak terjadi
            continue

        # --- LANGKAH KRUSIAL: HAPUS SEMUA PARTS DULU ---
        anchor_original_predecessor = depot_id  # Node sebelum anchor
        anchor_found_in_target_initially = False  # Apakah anchor awalnya di target?

        # Cek dulu apakah anchor ada di target route awal
        if anchor_part_for_pos in new_routes[target_route_idx]:
            anchor_found_in_target_initially = True
            try:
                anchor_idx = new_routes[target_route_idx].index(anchor_part_for_pos)
                if anchor_idx > 0:
                    anchor_original_predecessor = new_routes[target_route_idx][
                        anchor_idx - 1
                    ]
            except ValueError:
                anchor_found_in_target_initially = False  # Seharusnya tidak terjadi

        # Hapus SEMUA parts dari SEMUA rute
        for ri, r in enumerate(new_routes):
            indices_to_remove = []
            for i in range(
                len(r) - 1, 0, -1
            ):  # Iterasi terbalik, jangan hapus depot[0]
                node_id = r[i]
                if node_id in parts_set:
                    indices_to_remove.append(i)

            # Lakukan penghapusan setelah iterasi selesai
            if indices_to_remove:
                indices_to_remove.sort(reverse=True)  # Hapus dari belakang
                for idx in indices_to_remove:
                    # Jaga-jaga index out of bounds jika ada duplikat aneh
                    if idx < len(r):
                        r.pop(idx)
        # --- SELESAI MENGHAPUS ---

        # 3. Tentukan posisi sisip di rute target
        target_route = new_routes[target_route_idx]
        insert_pos = 1  # Default setelah depot

        # Cari posisi SETELAH predecessor anchor
        try:
            # Cari dari awal rute (predecessor mungkin sudah berubah posisinya)
            predecessor_pos = target_route.index(anchor_original_predecessor)
            insert_pos = predecessor_pos + 1
        except ValueError:
            # Jika predecessor tidak ditemukan, sisipkan setelah depot
            insert_pos = 1

        # Jika rute target jadi kosong (hanya [0,0]), insert_pos tetap 1
        if len(target_route) < 2:
            insert_pos = 1
        # Pastikan insert_pos tidak melebihi panjang list (sebelum depot akhir)
        insert_pos = (
            min(insert_pos, len(target_route) - 1) if len(target_route) > 1 else 1
        )

        # 4. Sisipkan kembali SEMUA parts BERURUTAN di posisi yg benar
        # parts sudah diurutkan dari groups
        parts_to_insert = parts
        target_route[insert_pos:insert_pos] = parts_to_insert

    # 5. Safety pass kapasitas
    fixed, _ = ensure_all_routes_capacity(
        new_routes, nodes, vehicle_capacity, refill_ids, tm, depot_id
    )
    return fixed


# Fungsi best_insertion_index_for_node tidak dipakai di logic utama ensure_groups,
# tapi mungkin dibutuhkan oleh fungsi lain, jadi biarkan.
# Pastikan isinya benar.
def best_insertion_index_for_node(
    route: List[str], nid: str, nodes: Dict[str, Node], tm: TimeMatrix
) -> int:
    node_to_insert = nodes.get(nid)
    if not node_to_insert:
        return 1  # Default jika node tidak ada

    best_j = 1
    best_delta = float("inf")
    for j in range(1, len(route)):
        a, b = route[j - 1], route[j]
        # Pastikan a dan b ada di tm sebelum menghitung travel
        if a in tm.index and b in tm.index and nid in tm.index:
            delta = (
                tm.travel(a, nid)
                + tm.travel(nid, b)
                - tm.travel(a, b)
                + node_to_insert.service_min  # Akses langsung
            )
            if delta < best_delta:
                best_delta = delta
                best_j = j
        else:
            pass  # Abaikan posisi jika node tidak ada di matrix
    # Jika tidak ada posisi valid sama sekali, default ke 1
    return best_j if best_delta != float("inf") else 1
