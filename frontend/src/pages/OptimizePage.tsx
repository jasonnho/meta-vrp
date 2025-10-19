// src/pages/OptimizePage.tsx
import { useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Api } from "../lib/api"
import type { OptimizeResponse, Node, Group } from "../types"
import { minutesToHHMM } from "../lib/format"
import NodesMapSelector from "../components/NodesMapSelector"
import { useUI } from "../stores/ui"
import { useOptimizeMem } from "../stores/optimize"

// shadcn ui
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Play, Trash2, ListChecks, Users } from "lucide-react"

export default function OptimizePage() {
  // data nodes & groups
  const nodesQ = useQuery({ queryKey: ["nodes"], queryFn: Api.listNodes })
  const groupsQ = useQuery<Group[]>({ queryKey: ["groups"], queryFn: Api.listGroups })

  // selection titik
  const { maxVehicles, setMaxVehicles, selected, setSelected } = useUI()

  const toggle = (id: string) => {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }

  const selectAll = () => {
    if (!nodesQ.data) return
    setSelected(new Set((nodesQ.data as Node[]).map((n) => n.id)))
  }
  const clearAll = () => setSelected(new Set())

  // apply group → replace selection
  const applyGroup = (g: Group) => {
    setSelected(new Set(g.nodeIds ?? []))
  }

  const { toast } = useToast()
  const { lastResult, setLastResult, clearLastResult } = useOptimizeMem()
  const [groupQuery, setGroupQuery] = useState("")

  const optimize = useMutation({
    mutationFn: (payload: any) => Api.optimize(payload),
    onSuccess: (res, variables) => {
      setLastResult(res, {
        num_vehicles: variables?.num_vehicles,
        selected_node_ids: variables?.selected_node_ids ?? [],
      })
      toast({
        title: "Optimisasi selesai",
        description: `Objective ${res.objective_time_min} menit (${minutesToHHMM(
          res.objective_time_min,
        )})`,
      })
    },
    onError: (err: any) => {
      toast({
        title: "Gagal menjalankan optimisasi",
        description:
          err?.response?.data?.detail ?? err?.message ?? "Terjadi kesalahan tak terduga.",
        variant: "destructive",
      })
    },
  })

  const handleRun = () => {
    const node_ids = Array.from(selected)
    optimize.mutate({
      num_vehicles: maxVehicles,
      selected_node_ids: node_ids,
    })
  }

  const data: OptimizeResponse | undefined = optimize.data ?? lastResult

  // ringkasan
  const summary = useMemo(() => {
    if (!data) return null
    const totRoute = data.routes.length
    const totSeq = data.routes.reduce((s, r) => s + r.sequence.length, 0)
    return { totRoute, totSeq }
  }, [data])

  const canRun = !optimize.isPending && maxVehicles > 0 && selected.size > 0

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Optimize</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ListChecks className="h-4 w-4" />
          <span>
            Selected: <span className="font-medium text-foreground">{selected.size}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* kiri: map */}
        <div className="lg:col-span-8">
          <Card className="h-full">
            <CardHeader className="py-3">
              <CardTitle className="text-base">Pilih Titik</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {nodesQ.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading points…
                </div>
              )}
              {nodesQ.isError && (
                <div className="text-sm text-destructive">Failed to load nodes.</div>
              )}
              {nodesQ.data && (
                <div className="rounded-lg border">
                  <NodesMapSelector
                    nodes={nodesQ.data as Node[]}
                    selected={selected}
                    onToggle={toggle}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* kanan: controls + groups + summary */}
        <div className="lg:col-span-4 space-y-4">
          {/* Pengaturan */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Pengaturan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="block text-xs mb-1 text-muted-foreground">Max Vehicles</label>
                <Input
                  type="number"
                  min={0}
                  value={maxVehicles}
                  onChange={(e) => setMaxVehicles(Number(e.target.value))}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={selectAll}>
                  Select all
                </Button>
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  Clear
                </Button>
              </div>

              <Button
                className="w-full"
                disabled={!canRun}
                onClick={handleRun}
              >
                {optimize.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running…
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Optimization
                  </>
                )}
              </Button>

              {optimize.isError && (
                <div className="text-xs text-destructive">
                  {(optimize.error as any)?.response?.data?.detail ??
                    (optimize.error as any)?.message ??
                    "Failed."}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Groups */}
          <Card>
            <CardHeader className="py-3 flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Groups
              </CardTitle>
              <Badge variant="secondary" className="ml-auto">
                {(groupsQ.data ?? []).length} total
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                placeholder="Cari group…"
                value={groupQuery}
                onChange={(e) => setGroupQuery(e.target.value)}
              />

              {groupsQ.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading groups…
                </div>
              ) : groupsQ.isError ? (
                <div className="text-sm text-destructive">Failed to load groups.</div>
              ) : (groupsQ.data ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">Belum ada group.</div>
              ) : (
                // SCROLL CONTAINER: batasi tinggi agar halaman tidak memanjang
                <div className="max-h-60 overflow-auto rounded-md border">
                  <ul className="divide-y">
                    {(groupsQ.data!
                      .filter((g) =>
                        groupQuery.trim()
                          ? g.name.toLowerCase().includes(groupQuery.toLowerCase())
                          : true,
                      )).map((g) => (
                      <li
                        key={g.id}
                        className="py-2 px-2 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{g.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {(g.nodeIds?.length ?? 0)} points
                            {g.description ? " · " : ""}
                            {g.description ? (
                              <span className="opacity-80">{g.description}</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="shrink-0 flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => applyGroup(g)}
                            title="Apply group (replace selection)"
                          >
                            Apply
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ringkasan hasil (kalau ada) */}
          {data && (
            <Card>
              <CardHeader className="py-3 flex-row items-center justify-between">
                <CardTitle className="text-base">Ringkasan</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearLastResult}
                  title="Hapus hasil optimasi terakhir"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </CardHeader>

              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Objective (min)</span>
                  <b>
                    {data.objective_time_min} ({minutesToHHMM(data.objective_time_min)})
                  </b>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vehicles Used</span>
                  <b>{data.vehicle_used}</b>
                </div>
                {summary && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Steps</span>
                    <b>{summary.totSeq}</b>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* tabel rute */}
      {data?.routes?.length ? (
        <Card className="overflow-hidden">
          <CardHeader className="py-3">
            <CardTitle className="text-base">Rute Per Kendaraan</CardTitle>
          </CardHeader>
          <div className="max-w-full overflow-x-auto">
            <Table className="min-w-[880px]">
              <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40">
                <TableRow>
                  <TableHead className="w-[120px]">Vehicle</TableHead>
                  <TableHead className="w-[180px]">Total Time</TableHead>
                  <TableHead>Sequence</TableHead>
                  <TableHead className="w-[260px]">Load</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.routes.map((r) => (
                  <TableRow key={r.vehicle_id}>
                    <TableCell>#{r.vehicle_id}</TableCell>
                    <TableCell>
                      {r.total_time_min} ({minutesToHHMM(r.total_time_min)})
                    </TableCell>
                    <TableCell className="font-mono text-xs break-all">
                      {r.sequence.join(" → ")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      [{r.load_profile_liters.join(", ")}]
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableCaption className="text-xs">
                {summary
                  ? `${summary.totRoute} route • ${summary.totSeq} steps`
                  : `${data.routes.length} route`}
              </TableCaption>
            </Table>
          </div>
        </Card>
      ) : null}
    </section>
  )
}
