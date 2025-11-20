// src/components/app-nav.tsx
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
// Import ikon-ikon baru yang relevan
import {
    Map, // Menggantikan Home
    History, // Menggantikan List
    Activity,
    Users,
    ClipboardList,
} from "lucide-react";

type Item = {
    to: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
};

// === PERUBAHAN UTAMA DI SINI ===
// Mengganti label, ikon, dan mengurutkan ulang
const ITEMS: Item[] = [
    { to: "/", label: "Optimasi", icon: Map },
    { to: "/groups", label: "Manajemen Grup", icon: ClipboardList },
    { to: "/assign", label: "Penugasan", icon: Users },
    { to: "/status", label: "Status Lapangan", icon: Activity },
    { to: "/logs", label: "Histori", icon: History },
];
// ===============================

export function AppNav({ onNavigate }: { onNavigate?: () => void }) {
    return (
        // Tambahkan padding (p-4) agar rapi di dalam dialog mobile
        <nav className="flex flex-col gap-1 p-4">
            {ITEMS.map(({ to, label, icon: Icon }) => (
                <NavLink
                    key={to}
                    to={to}
                    // Tambahkan 'end' prop agar link root ("/") tidak selalu aktif
                    end={to === "/"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                        cn(
                            "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors", // Sedikit padding vertikal
                            "hover:bg-accent hover:text-accent-foreground",
                            isActive
                                ? "bg-accent text-accent-foreground font-semibold" // Dibuat font-semibold saat aktif
                                : "text-muted-foreground"
                        )
                    }
                >
                    <Icon className="h-4 w-4" />
                    {label}
                </NavLink>
            ))}
        </nav>
    );
}
