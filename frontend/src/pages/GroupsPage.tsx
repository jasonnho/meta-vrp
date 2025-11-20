// src/pages/GroupsPage.tsx
import { useEffect, useMemo, useState } from "react" // Tambahkan useState
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { Api } from "../lib/api"
import type { Group } from "../types"
import GroupFormModal from "../components/GroupFormModal"
import { useAllNodes } from "../hooks/useAllNodes"
import { useGroupsUI } from "../stores/groups"
import { motion, AnimatePresence } from "framer-motion"

// --- SHADCN UI ---
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

// --- ICONS ---
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  AlertCircle,
  Inbox,
  Search,
  XCircle,
} from "lucide-react"

export default function GroupsPage() {
  const qc = useQueryClient()
  const [sp, setSp] = useSearchParams()
  const { modal, openNew, openEdit, close } = useGroupsUI()

  // State baru untuk Alert Dialog
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // ==== Data Groups ====
  const {
    data: groups = [],
    isLoading,
    error,
    isFetching,
  } = useQuery<Group[]>({
    queryKey: ["groups"],
    queryFn: Api.listGroups,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  })

  const filteredGroups = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return groups // Jika tidak ada query, tampilkan semua

    return groups.filter(g =>
      g.name.toLowerCase().includes(query) ||
      g.description?.toLowerCase().includes(query)
    )
  }, [groups, searchQuery])

  const { data: allNodes = [] } = useAllNodes()

  const create = useMutation({
    mutationFn: Api.createGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  })

  const update = useMutation({
    mutationFn: (p: {
      id: string
      patch: Partial<Pick<Group, "name" | "nodeIds" | "description">>
    }) => Api.updateGroup(p.id, p.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  })

  const remove = useMutation({
    mutationFn: Api.deleteGroup,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] })
      setDeletingGroup(null) // Tutup dialog setelah berhasil
    },
    onError: () => {
      // Biarkan dialog terbuka untuk menampilkan error jika perlu
      // (atau tambahkan toast error)
    }
  })

  // ==== Sinkron modal <-> URL (?group=new | ?group=<id>) ====
  // Baca dari URL saat mount
  useEffect(() => {
    const g = sp.get("group")
    if (g === "new") {
      openNew()
    } else if (g) {
      openEdit(g)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tulis ke URL saat modal berubah
  useEffect(() => {
    const next = new URLSearchParams(sp)
    if (modal.mode === "new") {
      next.set("group", "new")
    } else if (modal.mode === "edit") {
      next.set("group", modal.id)
    } else {
      next.delete("group")
    }
    setSp(next, { replace: true })
  }, [modal, sp, setSp])

  // Cari group yang sedang diedit (kalau ada)
  const editingGroup: Group | undefined = useMemo(() => {
    if (modal.mode !== "edit") return undefined
    return groups.find((g) => String(g.id) === String(modal.id))
  }, [modal, groups])

  // ==== Render ====

  // Helper untuk konten utama
  const renderContent = () => {
    if (isLoading) {
      return <GroupsTableSkeleton />
    }

    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Gagal Memuat Grup</AlertTitle>
          <AlertDescription>
            {(error as Error).message}
          </AlertDescription>
        </Alert>
      )
    }

    if (filteredGroups.length === 0 && !isLoading) {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Inbox className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Belum Ada Grup</h3>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">
            Buat grup baru untuk menyimpan sekumpulan titik taman.
          </p>
          <Button onClick={() => openNew()}>
            <Plus className="mr-2 h-4 w-4" />
            Buat Grup Baru
          </Button>
        </div>
      )
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Grup</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead className="w-[120px]">Jumlah Titik</TableHead>
              <TableHead className="w-[180px]">Dibuat Pada</TableHead>
              <TableHead className="w-[80px] text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence>
            {filteredGroups.map((g) => (
              <motion.tr // <-- Ganti TableRow jadi motion.tr
                  key={g.id}
                  layout // <-- Agar animasi smooth saat item dihapus/filter
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  // --- TAMBAHKAN HOVER HIGHLIGHT ---
                  className="hover:bg-muted/50 transition-colors"
                  // ------------------------------------
                >
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell className="text-muted-foreground truncate max-w-xs">
                  {g.description || "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{g.nodeIds?.length ?? 0} titik</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {g.createdAt ? new Date(g.createdAt).toLocaleString() : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {/* UPGRADE ke DropdownMenu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => openEdit(String(g.id))}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeletingGroup(g)} // Buka AlertDialog
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Hapus
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </motion.tr>
            ))}
            </AnimatePresence>
          </TableBody>
          <TableCaption>
            Menampilkan {filteredGroups.length} dari total {groups.length} grup.
          </TableCaption>
        </Table>
      </div>
    )
  }

  return (
    <section className="space-y-6 p-1">
      {/* ====== HEADER HALAMAN ====== */}
      {/* ====== HEADER HALAMAN ====== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Grup</h1>
          <p className="text-muted-foreground">
            Buat, edit, atau hapus grup titik taman untuk optimasi.
          </p>
        </div>

        {/* --- MODIFIKASI DIV INI --- */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Input Searchbar Baru */}
          {/* Input Searchbar Baru (dengan tombol clear) */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Cari nama atau deskripsi..."
              // Beri padding kanan agar 'x' tidak nabrak teks
              className="pl-8 pr-8 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {/* Tombol Clear, muncul jika ada query */}
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7 rounded-full"
                onClick={() => setSearchQuery("")} // <-- Aksi clear
              >
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>
          {isFetching && !isLoading && (
            <Badge variant="outline" className="gap-1.5 py-1.5 hidden sm:flex"> {/* Sembunyikan di mobile agar rapi */}
              <Loader2 className="h-4 w-4 animate-spin" />
              Sinkronisasi...
            </Badge>
          )}
          <Button onClick={() => openNew()} className="flex-shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Buat Grup
          </Button>
        </div>
        {/* --- BATAS MODIFIKASI --- */}

      </div>

      {/* ====== KONTEN UTAMA (Tabel, Loading, Error, Empty) ====== */}
      {renderContent()}

      {/* ====== MODAL FORM (Logika tidak berubah) ====== */}
      {(modal.mode === "new" || modal.mode === "edit") && (
        <GroupFormModal
          open
          initial={
            modal.mode === "edit" && editingGroup
              ? {
                  name: editingGroup.name,
                  nodeIds: editingGroup.nodeIds ?? [],
                  description: editingGroup.description ?? "",
                }
              : undefined
          }
          allNodes={allNodes}
          onClose={() => {
            close()
          }}
          onSubmit={(v) => {
            if (modal.mode === "new") {
              create.mutate(v)
            } else if (modal.mode === "edit") {
              update.mutate({ id: editingGroup?.id ?? modal.id, patch: v })
            }
            // Jangan close() di sini agar user bisa lihat loading state
            // close() akan dipanggil otomatis oleh onSuccess mutation (jika berhasil)
            // Jika gagal, modal tetap terbuka
          }}
          // --- TAMBAHKAN PROP INI ---
          isLoading={create.isPending || update.isPending}
          // --------------------------
        />
      )}

      {/* ====== MODAL KONFIRMASI HAPUS (BARU) ====== */}
      <AlertDialog
        open={!!deletingGroup}
        onOpenChange={(open) => !open && setDeletingGroup(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anda yakin ingin menghapus grup ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Grup <span className="font-bold">"{deletingGroup?.name}"</span> akan
              dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletingGroup) remove.mutate(deletingGroup.id)
              }}
              disabled={remove.isPending}
              asChild
            >
              <AlertDialogAction>
                {remove.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Ya, Hapus
              </AlertDialogAction>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

// Komponen helper baru untuk Skeleton Loading
function GroupsTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama Grup</TableHead>
            <TableHead>Deskripsi</TableHead>
            <TableHead className="w-[120px]">Jumlah Titik</TableHead>
            <TableHead className="w-[180px]">Dibuat Pada</TableHead>
            <TableHead className="w-[80px] text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(3)].map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-5 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-48" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-32" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="h-8 w-8 ml-auto" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
