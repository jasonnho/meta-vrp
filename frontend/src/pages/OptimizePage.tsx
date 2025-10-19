// src/pages/OptimizePage.tsx
import { useMemo, useState, useEffect } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Api } from "../lib/api"
import type { OptimizeResponse, Node, Group } from "../types"
import { minutesToHHMM } from "../lib/format"
import NodesMapSelector from "../components/NodesMapSelector"
import { useUI } from "../stores/ui"
import { useOptimizeMem } from "../stores/optimize"

// --- SHADCN UI (YANG BARU DITAMBAH) ---
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
// --- (YANG LAMA) ---
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
// --- ICONS ---
import {
  Loader2,
  Play,
  Trash2,
  ListChecks,
  Users,
  MapPin, // baru
  Settings, // baru
  Search, // baru
  CheckCircle2, // baru
  AlertCircle, // baru
  ListTree, // baru
  Truck, // baru
} from "lucide-react"

export default function OptimizePage() {
  // data nodes & groups
  const nodesQ = useQuery({ queryKey: ["nodes"], queryFn: Api.listNodes })
  const groupsQ = useQuery<Group[]>({ queryKey: ["groups"], queryFn: Api.listGroups })

  // selection titik
  const { maxVehicles, setMaxVehicles, selected, setSelected } = useUI()

  // --- 1. BUAT DERIVED STATE UNTUK NODE YANG DITAMPILKAN ---
  const displayNodes = useMemo(() => {
    if (!nodesQ.data) {
      return [];
    }
    // Filter node '0' DAN hanya ambil yang jenisnya 'park'
    return (nodesQ.data as Node[]).filter(node =>
      node.id !== '0' && node.kind === 'park'
    );
  }, [nodesQ.data]); // Dependensi tetap sama
  // --------------------------------------------------------

  const toggle = (id: string) => {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }

  const selectAll = () => {
    // if (!nodesQ.data) return // Kita sudah pakai displayNodes, jadi cek ini tidak perlu
    // Gunakan displayNodes untuk memilih semua
    setSelected(new Set(displayNodes.map((n) => n.id)));
  }
  const clearAll = () => setSelected(new Set())

  // apply group → replace selection
  const applyGroup = (g: Group) => {
    setSelected(new Set(g.nodeIds ?? []))
    toast({
      title: "Grup Diterapkan",
      description: `Memilih ${g.nodeIds?.length ?? 0} titik dari grup "${g.name}".`,
    })
  }

  const { toast } = useToast()
  const { lastResult, setLastResult, clearLastResult } = useOptimizeMem()
  const [groupQuery, setGroupQuery] = useState("")

  const [progress, setProgress] = useState(0)

  const optimize = useMutation({
    mutationFn: (payload: any) => Api.optimize(payload),
    onSuccess: (res, variables) => {
      setLastResult(res, {
        num_vehicles: variables?.num_vehicles,
        selected_node_ids: variables?.selected_node_ids ?? [],
      })
      toast({
        title: "Optimisasi Selesai",
        description: `Objective ${res.objective_time_min} menit (${minutesToHHMM(
          res.objective_time_min,
        )})`,
        action: (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ),
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

  // Filter groups
  const filteredGroups = useMemo(() => {
    if (!groupsQ.data) return []
    return groupsQ.data.filter((g) =>
      groupQuery.trim()
        ? g.name.toLowerCase().includes(groupQuery.toLowerCase())
        : true,
    )
  }, [groupsQ.data, groupQuery])

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;

    if (optimize.isPending) {
      setProgress(0); // Selalu reset saat mutasi baru dimulai

      const interval = 300; // Update setiap 300ms
      const totalDuration = 30 * 1000; // 30 detik
      // Hitung berapa persen kenaikan setiap interval
      const increment = (interval / totalDuration) * 100; // = 1%

      timer = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + increment;
          if (newProgress >= 100) {
            clearInterval(timer);
            return 100; // Selesai
          }
          return newProgress;
        });
      }, interval);
    }

    // Cleanup function (dijalankan saat unmount atau saat isPending berubah)
    return () => {
      clearInterval(timer);
      // Saat mutasi selesai (onSuccess/onError), isPending jadi false,
      // hook ini akan re-run. Cleanup dari run sebelumnya dipanggil.
      // Kita reset progress di sini jika sudah tidak pending.
      if (!optimize.isPending) {
        setProgress(0);
      }
    };
  }, [optimize.isPending]); // Hanya bergantung pada status isPending
  // --------------------------------------------------

  return (
    <section className="space-y-6 p-1"> {/* Tambah padding sedikit */}
      {/* ====== HEADER HALAMAN ====== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Optimasi Rute</h1>
          <p className="text-muted-foreground">
            Pilih titik taman, atur parameter, dan jalankan kalkulasi rute.
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
          <ListChecks className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Titik Dipilih:</span>
          <Badge variant="default" className="text-base px-3 py-1">
            {selected.size}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ====== KIRI: MAP ====== */}
        {/* Kita buat perbandingan 7:5 agar map lebih besar sedikit */}
        <div className="lg:col-span-7">
          <Card className="h-full min-h-[600px] flex flex-col"> {/* Pastikan card mengisi tinggi */}
            <CardHeader className="flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Peta Titik Taman</CardTitle>
              </div>
              {/* Tombol select/clear kita pindah ke sini agar dekat Peta */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Pilih Semua
                </Button>
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  Bersihkan
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 pt-0 flex flex-col">
              {nodesQ.isLoading && (
                <Alert className="mt-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertTitle>Memuat Data Peta</AlertTitle>
                  <AlertDescription>
                    Sedang mengambil data titik taman...
                  </AlertDescription>
                </Alert>
              )}
              {nodesQ.isError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Gagal Memuat</AlertTitle>
                  <AlertDescription>
                    Tidak dapat mengambil data titik. Coba refresh halaman.
                  </AlertDescription>
                </Alert>
              )}
              {nodesQ.data && (
                // Wrapper ini penting agar map bisa mengisi sisa space
                <div className="flex-1 rounded-lg border overflow-hidden">
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

        {/* ====== KANAN: KONTROL (TABS) ====== */}
        <div className="lg:col-span-5">
          {/* Ini adalah perubahan terbesar: mengganti 3 Card dengan 1 Tabs */}
          <Tabs defaultValue="settings" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="settings">
                <Settings className="mr-2 h-4 w-4" />
                Pengaturan
              </TabsTrigger>
              <TabsTrigger value="groups">
                <Users className="mr-2 h-4 w-4" />
                Groups
              </TabsTrigger>
            </TabsList>

            {/* --- TAB CONTENT 1: PENGATURAN & HASIL --- */}
            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Parameter Optimasi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Input Max Vehicles */}
                  <div className="space-y-2">
                    <Label htmlFor="max-vehicles">Jumlah Mobil (Max Vehicles)</Label>
                    <Input
                      id="max-vehicles"
                      type="number"
                      min={1}
                      value={maxVehicles}
                      onChange={(e) => setMaxVehicles(Math.max(1, Number(e.target.value)))}
                      className="text-base font-medium"
                    />
                    <p className="text-xs text-muted-foreground">
                      Jumlah maksimum mobil penyiram yang tersedia.
                    </p>
                  </div>

                  <Separator />

                  {/* Tombol Run */}
                  <Button
                    size="lg"
                    className="w-full"
                    // Tombol non-aktif jika tidak bisa run ATAU jika sedang berjalan
                    disabled={!canRun || optimize.isPending}
                    onClick={handleRun}
                  >
                    {optimize.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Menjalankan Kalkulasi...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Jalankan Optimasi
                      </>
                    )}
                  </Button>

                  {/* --- TAMBAHKAN BLOK INI (Progress Bar) --- */}
                  {optimize.isPending && (
                    <div className="space-y-2 pt-2 text-center">
                      <Progress value={progress} className="w-full" />
                      <p className="text-sm text-muted-foreground">
                        Estimasi waktu: 30 detik... ({Math.round(progress)}%)
                      </p>
                    </div>
                  )}
                  {/* --- BATAS BLOK TAMBAHAN --- */}

                  {/* Pesan Error jika gagal run */}
                  {optimize.isError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Optimasi Gagal</AlertTitle>
                      <AlertDescription>
                        {(optimize.error as any)?.response?.data?.detail ??
                          (optimize.error as any)?.message ??
                          "Failed."}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Tampilkan card ringkasan HANYA jika ada data */}
              {data && (
                <Card>
                  <CardHeader className="py-4 flex-row items-center justify-between">
                    <CardTitle className="text-base">Ringkasan Hasil</CardTitle>
                    <Button
                      variant="ghost" // Ganti jadi ghost
                      size="sm"
                      onClick={clearLastResult}
                      title="Hapus hasil optimasi terakhir"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Bersihkan Hasil
                    </Button>
                  </CardHeader>

                  <CardContent className="text-sm space-y-3">
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                      <span className="text-muted-foreground">Total Waktu (Objective)</span>
                      <b className="text-lg text-primary">
                        {data.objective_time_min} min ({minutesToHHMM(data.objective_time_min)})
                      </b>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Mobil Terpakai</span>
                      <b>{data.vehicle_used} / {lastResult?.params?.num_vehicles ?? maxVehicles}</b>
                    </div>
                    {summary && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Total Kunjungan</span>
                        <b>{summary.totSeq} titik</b>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* --- TAB CONTENT 2: GROUPS --- */}
            <TabsContent value="groups">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Grup Tersimpan</CardTitle>
                  <CardDescription>
                    Terapkan grup untuk memilih sekumpulan titik dengan cepat.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Input Search dengan Icon */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari group…"
                      value={groupQuery}
                      onChange={(e) => setGroupQuery(e.target.value)}
                      className="pl-8" // beri padding kiri untuk icon
                    />
                  </div>

                  {groupsQ.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground pt-4 justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading groups…
                    </div>
                  ) : groupsQ.isError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Gagal Memuat Grup</AlertTitle>
                    </Alert>
                  ) : (groupsQ.data ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center pt-4">
                      Belum ada group.
                    </p>
                  ) : (
                    // Ganti <ul> dengan <ScrollArea> agar tingginya terbatas
                    <ScrollArea className="h-96 rounded-md border">
                      <div className="p-2">
                        {filteredGroups.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center p-4">
                            Grup tidak ditemukan.
                          </p>
                        )}
                        {filteredGroups.map((g) => (
                          <li
                            key={g.id}
                            className="list-none py-2 px-3 flex items-center justify-between gap-3 rounded-md hover:bg-muted/50"
                          >
                            <div className="min-w-0">
                              <div className="font-medium truncate">{g.name}</div>
                              <div className="text-xs text-muted-foreground flex gap-2">
                                <span>{(g.nodeIds?.length ?? 0)} points</span>
                                {g.description && (
                                  <>
                                    <span>·</span>
                                    <span className="truncate opacity-80">{g.description}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary" // Ganti jadi secondary agar tidak terlalu ramai
                              onClick={() => applyGroup(g)}
                              title="Apply group (replace selection)"
                            >
                              Terapkan
                            </Button>
                          </li>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ====== BAWAH: TABEL RUTE ====== */}
      {data?.routes?.length ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-3">
              <ListTree className="h-5 w-5 text-primary" />
              Detail Rute per Kendaraan
            </CardTitle>
            <CardDescription>
              Detail urutan, waktu, dan muatan untuk setiap mobil yang digunakan.
            </CardDescription>
          </CardHeader>
          <div className="max-w-full overflow-x-auto">
            <Table className="min-w-[960px]"> {/* Sedikit lebih lebar */}
              <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40">
                <TableRow>
                  <TableHead className="w-[120px]">
                    <div className="flex items-center gap-2"><Truck className="h-4 w-4" /> Mobil</div>
                  </TableHead>
                  <TableHead className="w-[200px]">Total Waktu</TableHead>
                  <TableHead>Urutan (Sequence)</TableHead>
                  <TableHead className="w-[280px]">Profil Muatan (Liter)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.routes.map((r) => (
                  <TableRow key={r.vehicle_id}>
                    <TableCell className="font-medium">#{r.vehicle_id}</TableCell>
                    <TableCell className="font-medium">
                      {r.total_time_min} min ({minutesToHHMM(r.total_time_min)})
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
                  ? `${summary.totRoute} rute • ${summary.totSeq} total kunjungan`
                  : `${data.routes.length} rute`}
              </TableCaption>
            </Table>
          </div>
        </Card>
      ) : null}
    </section>
  )
}
