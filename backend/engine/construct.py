from typing import Dict, List, Set

from .data import Node, TimeMatrix


def _nearest(target_from: str, candidates: List[str], tm: TimeMatrix) -> str:
    """Helper: cari node_id terdekat dari target_from di antara list candidates."""
    if not candidates:
        raise ValueError("nearest(): candidates must be non-empty")

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
    selected_parks: List[str],  # Ini adalah 'selected_ids_expanded' dari app.py
    depot_id: str,
    num_vehicles: int,
    vehicle_capacity: float,
    allow_refill: bool,
    refill_ids: List[str],
) -> List[List[str]]:
    """
    Versi 'Group-Aware' dari greedy construct.
    Unit kerjanya adalah 'Grup' (misal ['1#1', '1#2', '1#3']), bukan 'part'.
    """

    # --- 1. Bangun Grup dari selected_parks (parts) ---
    groups: Dict[str, List[str]] = {}
    for part_id in selected_parks:
        # Hanya proses node yang bertipe 'park'
        node = nodes.get(part_id)
        if not node or node.type != "park":
            continue

        base_id = part_id.split("#")[0]
        groups.setdefault(base_id, []).append(part_id)

    # Pastikan urutan part di dalam grup benar (1#1, 1#2, ...)
    for base_id in groups:
        groups[base_id].sort()

    # 'unserved' sekarang berisi base_id, misal: {'1', '41', '8'}
    unserved: Set[str] = set(groups.keys())

    if not unserved:
        # Jika tidak ada park yang dipilih, kembalikan rute kosong
        return [[depot_id, depot_id] for _ in range(max(1, num_vehicles))][:1]

    # --- 2. HAPUS VALIDASI 'too_big' ---
    # Validasi 'demand > capacity' sudah tidak relevan
    # karena 'expand_split_delivery' menjamin tiap part <= capacity.

    routes: List[List[str]] = []

    # --- 3. Loop Utama (Per Kendaraan) ---
    for _ in range(num_vehicles):
        route = [depot_id]
        cur = depot_id
        rem = 0.0  # Asumsi truk mulai kosong

        MAX_ITERS = 1_000_000
        iters = 0

        while unserved:
            iters += 1
            if iters > MAX_ITERS:
                raise RuntimeError(
                    "greedy_construct: iteration cap reached (possible infinite loop)"
                )

            # --- Logika 'Group-Aware' Baru ---

            # 1. Cari semua 'anchor' (part pertama) dari grup yang belum dilayani
            #    Contoh: ['1#1', '41#1', '8']
            unserved_anchors = [
                groups[base_id][0] for base_id in unserved if groups[base_id]
            ]
            if not unserved_anchors:
                break  # Tidak ada lagi yang bisa dilayani

            # 2. Pilih GRUP terdekat berdasarkan anchor-nya
            nxt_anchor = _nearest(cur, unserved_anchors, tm)
            base_id = nxt_anchor.split("#")[0]  # Misal: '1'
            parts_to_serve = groups[base_id]  # Misal: ['1#1', '1#2', '1#3']

            # 3. Coba layani SELURUH BLOK, sisipkan refill jika perlu
            block_feasible = True
            temp_block_nodes = []  # List node (refill/part) yang akan ditambahkan

            # Simpan state sementara, jangan ubah 'cur' dan 'rem' asli
            temp_cur = cur
            temp_rem = rem

            for part in parts_to_serve:
                demand = nodes[part].demand_liters

                if demand > (temp_rem + 1e-9):  # Perlu refill
                    if not allow_refill or not refill_ids:
                        block_feasible = False  # Tidak bisa refill, grup ini gagal
                        break

                    # Cek infinite loop: sudah di refill, penuh, tapi demand masih > rem
                    if temp_rem >= vehicle_capacity and temp_cur in refill_ids:
                        block_feasible = False  # Gagal, demand > kapasitas
                        break

                    # Cari refill terdekat
                    r = _nearest(temp_cur, refill_ids, tm)
                    if r != temp_cur:
                        temp_block_nodes.append(r)
                        temp_cur = r
                    temp_rem = vehicle_capacity  # Isi penuh

                    # Cek lagi: apakah setelah isi penuh, demand masih > kapasitas?
                    if demand > (temp_rem + 1e-9):
                        block_feasible = False  # Gagal, demand > kapasitas
                        break

                # --- Muatan Cukup (baik dari sisa atau setelah refill) ---
                temp_block_nodes.append(part)
                temp_rem -= demand
                temp_cur = part

            # 4. Cek hasil simulasi blok
            if block_feasible:
                # Sukses, terapkan perubahan ke rute asli
                route.extend(temp_block_nodes)
                cur = temp_cur
                rem = temp_rem
                unserved.remove(base_id)  # Tandai GRUP ini selesai
                continue  # Lanjut ke 'while unserved' untuk cari grup berikutnya
            else:
                # Grup ini tidak muat/tidak bisa dilayani oleh kendaraan ini.
                # Hentikan rute untuk kendaraan ini.
                break
            # --- Akhir Logika 'Group-Aware' ---

        route.append(depot_id)
        routes.append(route)
        if not unserved:
            break  # Semua grup sudah dilayani

    # Karena itu, kita ubah sedikit: jika masih ada unserved,
    # paksa ke rute terakhir.
    if unserved and routes:
        route = routes[-1]
        route.pop()  # Hapus depot_id terakhir
        cur = route[-1]

        # Ambil 'rem' terakhir. Asumsi kita bisa refill dulu
        if cur not in refill_ids and allow_refill and refill_ids:
            r = _nearest(cur, refill_ids, tm)
            route.append(r)
            cur = r
            rem = vehicle_capacity
        elif cur in refill_ids:
            rem = vehicle_capacity
        else:
            # Tidak bisa refill, 'rem' adalah sisa terakhir.
            # (Logic 'rem' ini rumit, kita state ulang saja)
            rem = 0.0  # Anggap 0, paksa refill di iterasi pertama
            if cur != depot_id:
                r = _nearest(cur, refill_ids, tm)
                route.append(r)
                cur = r
                rem = vehicle_capacity

        # Ulangi logika 'group-aware' untuk sisa 'unserved'
        # Ini adalah 'best effort' dan mungkin jomplang,
        # tapi tujuannya adalah validitas (semua terlayani)

        # Salin base_id yang tersisa untuk di-loop
        remaining_groups = list(unserved)

        for base_id in remaining_groups:
            if base_id not in unserved:
                continue  # Mungkin sudah terlayani oleh grup lain? (tidak mungkin)

            parts_to_serve = groups[base_id]
            block_feasible = True
            temp_block_nodes = []

            temp_cur = cur
            temp_rem = rem

            for part in parts_to_serve:
                demand = nodes[part].demand_liters
                if demand > (temp_rem + 1e-9):
                    if not allow_refill or not refill_ids:
                        block_feasible = False
                        break
                    if temp_rem >= vehicle_capacity and temp_cur in refill_ids:
                        block_feasible = False
                        break
                    r = _nearest(temp_cur, refill_ids, tm)
                    if r != temp_cur:
                        temp_block_nodes.append(r)
                        temp_cur = r
                    temp_rem = vehicle_capacity
                    if demand > (temp_rem + 1e-9):
                        block_feasible = False
                        break

                temp_block_nodes.append(part)
                temp_rem -= demand
                temp_cur = part

            if block_feasible:
                route.extend(temp_block_nodes)
                cur = temp_cur
                rem = temp_rem
                unserved.remove(base_id)
            # else: biarkan, tidak bisa dipaksa

        route.append(depot_id)  # Tutup rute terakhir
        routes[-1] = route

    return routes
