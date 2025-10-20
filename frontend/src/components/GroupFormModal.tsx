// src/components/GroupFormModal.tsx
import { useEffect, useMemo, useState } from "react"

// --- SHADCN UI ---
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription, // Tambahkan ini
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label" // Baru
import { Textarea } from "@/components/ui/textarea" // Baru
import { Checkbox } from "@/components/ui/checkbox" // Baru
import { ScrollArea } from "@/components/ui/scroll-area" // Baru
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert" // Baru

// --- ICONS ---
import { Users, Search, AlertTriangle, Save, Loader2 } from "lucide-react" // Tambahkan ikon

type NodeLite = { id: string; name?: string; kind?: "park" | "refill" | "depot" | string }
type Props = {
  open: boolean
  initial?: { name: string; nodeIds: string[]; description?: string | null }
  allNodes: NodeLite[]
  onClose: () => void
  onSubmit: (v: { name: string; nodeIds: string[]; description?: string | null }) => void
  isLoading?: boolean
  // Tambahkan prop isLoading jika kamu mau (opsional)
  // isLoading?: boolean
}

export default function GroupFormModal({
  open,
  initial,
  allNodes,
  onClose,
  onSubmit,
  isLoading = false,
  // isLoading = false // opsional
}: Props) {
  const [name, setName] = useState(initial?.name ?? "")
  const [ids, setIds] = useState<string[]>(initial?.nodeIds ?? [])
  const [description, setDescription] = useState<string>(initial?.description ?? "")
  const [query, setQuery] = useState("")

  // parks only
  const parkNodes = useMemo(() => allNodes.filter((n) => n.kind === "park"), [allNodes])
  const parkIdSet = useMemo(() => new Set(parkNodes.map((n) => n.id)), [parkNodes])

  // refresh saat open/initial berubah
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "")
      setDescription(initial?.description ?? "")
      const filtered = (initial?.nodeIds ?? []).filter((id) => parkIdSet.has(id))
      setIds(filtered)
      setQuery("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, parkIdSet])

  const toggle = (id: string) =>
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const allFiltered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? parkNodes.filter((n) => (n.name ?? n.id).toLowerCase().includes(q))
      : parkNodes
    return list.sort((a,b) => (a.name ?? a.id).localeCompare(b.name ?? b.id)) // Sortir
  }, [parkNodes, query])

  const selectAllFiltered = () =>
    setIds((prev) => {
      const set = new Set(prev)
      for (const n of allFiltered) set.add(n.id)
      return Array.from(set)
    })
  const clearAllFiltered = () =>
    setIds((prev) => prev.filter((id) => !allFiltered.some((n) => n.id === id)))

  const totalSelected = ids.length
  const validSelected = ids.filter((id) => parkIdSet.has(id)).length

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : void 0)}>
      <DialogContent className="w-[95vw] sm:max-w-2xl lg:max-w-3xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur px-6 py-4 border-b">
          <DialogTitle className="text-lg flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            {initial ? "Edit Grup" : "Buat Grup Baru"}
          </DialogTitle>
          <DialogDescription>
            {parkNodes.length} total taman • {totalSelected} dipilih
          </DialogDescription>
        </DialogHeader>

        {/* Body (Scrollable) */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-4">
            {/* Nama */}
            <div className="space-y-2">
              <Label htmlFor="group-name">Nama Grup</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Grup Taman Wilayah Timur"
              />
            </div>

            {/* Deskripsi */}
            <div className="space-y-2">
              <Label htmlFor="group-desc">Deskripsi (Opsional)</Label>
              <Textarea
                id="group-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi singkat mengenai grup ini..."
                rows={3}
              />
            </div>

            {/* Garis Pemisah */}
            <div className="border-b pt-2"></div>

            {/* Search & actions */}
            <div className="space-y-2">
              <Label htmlFor="search-park">Pilih Titik Taman</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-park"
                    placeholder="Cari taman..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button variant="secondary" size="sm" onClick={selectAllFiltered}>
                  Pilih Semua
                </Button>
                <Button variant="ghost" size="sm" onClick={clearAllFiltered}>
                  Bersihkan
                </Button>
              </div>
            </div>

            {/* Daftar park (UPGRADE ke ScrollArea + Checkbox) */}
            <div className="rounded-md border">
              <ScrollArea className="h-64">
                {parkNodes.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    Tidak ada node bertipe "park".
                  </div>
                ) : allFiltered.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    Tidak ada hasil untuk “{query}”.
                  </div>
                ) : (
                  <div className="p-1">
                    {allFiltered.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50"
                      >
                        <Checkbox
                          id={`node-${n.id}`}
                          checked={ids.includes(n.id)}
                          onCheckedChange={() => toggle(n.id)}
                        />
                        <Label
                          htmlFor={`node-${n.id}`}
                          className="flex-1 min-w-0 cursor-pointer"
                        >
                          <div className="text-sm font-medium truncate">{n.name ?? n.id}</div>
                          <div className="text-xs text-muted-foreground font-mono truncate">
                            {n.id}
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Info validasi (UPGRADE ke Alert) */}
            {totalSelected !== validSelected && (
              <Alert variant="default">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Peringatan</AlertTitle>
                <AlertDescription>
                  Beberapa ID yang dipilih bukan "taman" dan akan diabaikan saat menyimpan.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t">
          <DialogClose asChild>
            {/* Nonaktifkan tombol Batal saat loading agar tidak bisa ditutup */}
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Batal
            </Button>
          </DialogClose>
          <Button
            // Nonaktifkan jika nama kosong ATAU sedang loading
            disabled={!name.trim() || isLoading}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                nodeIds: ids.filter((id) => parkIdSet.has(id)),
                description: description.trim() || null,
              })
            }
          >
            {/* Tampilkan spinner jika isLoading */}
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {/* Ubah teks tombol saat loading */}
            {isLoading ? "Menyimpan..." : "Simpan Grup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
