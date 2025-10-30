// frontend/src/layouts/AppShell.tsx
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";
// Impor yang DIPERLUKAN
import {
  ClipboardList,
  Map,
  Users,
  History,
  Activity,
  Leaf,
  Menu, // <-- 1. 'Menu' SUDAH DITAMBAHKAN
} from "lucide-react";

// --- SHADCN UI ---
import { Sheet, SheetContent} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
// 'Separator' dihapus (tidak terpakai)
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
// 'TooltipProvider' dihapus (sudah pindah ke App.tsx)
import { ThemeToggle } from "@/components/theme-toggle";

// --- Logo & Navigasi ---
const navLinks = [
  { to: "/", label: "Optimasi", icon: Map },
  { to: "/groups", label: "Manajemen Grup", icon: ClipboardList },
  { to: "/assign", label: "Penugasan", icon: Users },
  { to: "/status", label: "Status Lapangan", icon: Activity },
  { to: "/logs", label: "Histori", icon: History },
  { to: "/editor", label: "Editor Peta", icon: Leaf },
];

// Komponen Logo SVG
function AppLogo({ className }: { className?: string }) {
  return (
    <NavLink
      to="/"
      className={cn(
        "flex items-center gap-2.5 font-bold text-lg tracking-tight",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md",
        className
      )}
    >
      <div className="flex items-center justify-center w-8 h-8 bg-green-600 rounded-lg text-white">
        <Leaf className="w-5 h-5" />
      </div>
      <span>MetaVRP</span>
    </NavLink>
  );
}

// Komponen Navigasi (untuk desktop & mobile)
function AppNav() {
  const { pathname } = useLocation();
  return (
    <nav className="grid items-start gap-1.5">
      {navLinks.map((link) => {
        const isActive = pathname === link.to;
        return (
          <Tooltip key={link.to}>
            <TooltipTrigger asChild>
              <NavLink
                to={link.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{link.label}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

export default function AppShell() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="z-50 border-b bg-background/80 backdrop-blur flex-shrink-0">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              onClick={() => setOpen(true)}
            >
              <Menu className="h-5 w-5" /> {/* <-- 2. Ini sekarang valid */}
              <span className="sr-only">Buka menu</span>
            </Button>
            <AppLogo />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="container mx-auto flex-1 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 px-4 py-4 overflow-hidden">
        <aside className="hidden md:block h-full overflow-y-auto">
          <div className="sticky top-16">
            <AppNav />
          </div>
        </aside>

        <main className="h-full overflow-y-auto rounded-xl border bg-card">
          <div className="p-4 md:p-6">
            <Outlet /> {/* <-- Halaman Anda di-render di sini */}
          </div>
        </main>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex flex-col p-0 w-64">
          <div className="p-4 border-b">
            <AppLogo />
          </div>
          <div className="p-4 overflow-y-auto">
            <AppNav />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
