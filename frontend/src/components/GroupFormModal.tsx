// src/components/GroupFormModal.tsx
import { useEffect, useMemo, useState } from "react"

// shadcn ui yang sudah kamu install
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// NOTE: kamu belum install Textarea/Checkbox dari shadcn, jadi pakai native <textarea> & <input type="checkbox">.

type NodeLite = { id: string; name?: string; kind?: "park" | "refill" | "depot" | string }
type Props = {
  open: boolean
  initial?: { name: string; nodeIds: string[]; description?: string | null }
  allNodes: NodeLite[]
  onClose: () => void
  onSubmit: (v: { name: string; nodeIds: string[]; description?: string | null }) => void
}

export default function GroupFormModal({ open, initial, allNodes, onClose, onSubmit }: Props) {
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
    return list
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
      <DialogContent className="w-[95vw] sm:max-w-2xl lg:max-w-3xl p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 py-3 border-b">
          <DialogTitle className="text-base">
            {initial ? "Edit Group" : "New Group"}
          </DialogTitle>
          <div className="text-xs text-muted-foreground">
            {parkNodes.length} parks • {totalSelected} selected
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="max-h-[75vh] overflow-y-auto px-4 py-4 space-y-4">
          {/* Nama */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Group name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Group name"
            />
          </div>

          {/* Deskripsi */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (opsional)"
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Search & actions */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Cari park…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
            />
            <Button variant="secondary" onClick={selectAllFiltered}>
              Select all (filter)
            </Button>
            <Button variant="ghost" onClick={clearAllFiltered}>
              Clear (filter)
            </Button>
          </div>

          {/* Daftar park */}
          <div className="rounded-md border">
            {parkNodes.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">
                Tidak ada node bertipe <span className="font-medium">park</span>.
              </div>
            ) : (
              <ul className="max-h-64 overflow-auto divide-y">
                {allFiltered.map((n) => (
                  <li key={n.id} className="flex items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={ids.includes(n.id)}
                      onChange={() => toggle(n.id)}
                      className="h-4 w-4"
                    />
                    <div className="min-w-0">
                      <div className="text-sm truncate">{n.name ?? n.id}</div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">
                        {n.id}
                      </div>
                    </div>
                  </li>
                ))}
                {allFiltered.length === 0 && (
                  <li className="px-3 py-3 text-sm text-muted-foreground">
                    Tidak ada hasil untuk “{query}”.
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Info validasi (guard non-park) */}
          {totalSelected !== validSelected && (
            <div className="text-xs text-amber-600">
              Beberapa ID bukan park dan akan diabaikan saat menyimpan.
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-4 py-3 border-t">
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            disabled={!name.trim()}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                nodeIds: ids.filter((id) => parkIdSet.has(id)),
                description: description.trim() || null,
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
