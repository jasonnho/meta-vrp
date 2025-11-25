import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const ROUTE_COLORS = [
    { color: "#1d4ed8", label: "Biru" },
    { color: "#c026d3", label: "Ungu" },
    { color: "#db2777", label: "Pink" },
    { color: "#ea580c", label: "Oranye" },
    { color: "#ca8a04", label: "Kuning" },
    { color: "#059669", label: "Emerald" },
];

export default function MapLegend() {
    const [isOpen, setIsOpen] = useState(true);

    return (
        // UBAH POSISI: 'top-4 right-4' (Kanan Atas)
        // 'flex-col': Tombol di atas, konten di bawah (natural flow)
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 items-end">
            {/* Tombol Toggle */}
            <Button
                size="sm"
                variant="secondary"
                className="w-fit shadow-lg bg-white/90 backdrop-blur border border-zinc-200 dark:bg-zinc-900/90 dark:border-zinc-800 h-8 text-xs px-3"
                onClick={() => setIsOpen(!isOpen)}
            >
                <Info className="w-3 h-3 mr-2" />
                {isOpen ? "Tutup" : "Legenda"}
                {/* Logika Panah: Jika buka (isOpen), panah ATAS (tutup). Jika tutup, panah BAWAH (buka). */}
                {isOpen ? (
                    <ChevronUp className="w-3 h-3 ml-1" />
                ) : (
                    <ChevronDown className="w-3 h-3 ml-1" />
                )}
            </Button>

            {/* Konten Legend */}
            {isOpen && (
                <div
                    className={cn(
                        "p-3 rounded-lg shadow-xl border w-52 text-xs",
                        "bg-white/95 backdrop-blur dark:bg-zinc-950/95 border-zinc-200 dark:border-zinc-800",
                        // UBAH ANIMASI: slide dari atas ke bawah
                        "animate-in slide-in-from-top-2 duration-200"
                    )}
                >
                    <h4 className="font-semibold mb-2">Keterangan Peta</h4>

                    {/* Bagian 1: Tipe Lokasi */}
                    <div className="space-y-1.5 mb-3">
                        <div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                            Lokasi
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full border-2 border-gray-600 bg-white flex items-center justify-center shadow-sm">
                                <svg
                                    className="w-2.5 h-2.5 text-gray-600"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                >
                                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                    <polyline points="9 22 9 12 15 12 15 22" />
                                </svg>
                            </div>
                            <span>Depot Pusat</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full border-2 border-blue-600 bg-white flex items-center justify-center shadow-sm">
                                <svg
                                    className="w-2.5 h-2.5 text-blue-600"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                >
                                    <path d="M12 22a7 7 0 0 0 7-7c0-2-5-9-7-15-2 6-7 13-7 15a7 7 0 0 0 7 7z" />
                                </svg>
                            </div>
                            <span>Sumber Air</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full border-2 border-green-600 bg-white flex items-center justify-center shadow-sm">
                                <svg
                                    className="w-2.5 h-2.5 text-green-600"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                >
                                    <path d="M8 19h8a4 4 0 0 0 3.8-5.2 6 6 0 0 0-4-11.5 6 6 0 0 0-11.5 3.6C2.8 7.9 3 12.1 8 19Z" />
                                    <path d="M12 19v3" />
                                </svg>
                            </div>
                            <span>Taman Kota</span>
                        </div>
                    </div>

                    {/* Bagian 2: Warna Demand */}
                    <div className="space-y-1.5 mb-3">
                        <div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                            Kebutuhan Air
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-green-600 opacity-80"></div>
                            <span>&lt; 10k Liter (Rendah)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-yellow-600 opacity-80"></div>
                            <span>10k-20k Liter (Sedang)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-red-600 opacity-80"></div>
                            <span>&gt; 20k Liter (Tinggi)</span>
                        </div>
                    </div>

                    {/* Bagian 3: Rute Kendaraan */}
                    <div className="space-y-1.5">
                        <div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                            Rute Kendaraan
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {ROUTE_COLORS.map((rc, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center gap-2"
                                >
                                    <div
                                        className="w-6 h-1 rounded-full"
                                        style={{ backgroundColor: rc.color }}
                                    ></div>
                                    <span className="text-[10px]">
                                        Mobil {idx + 1}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
