import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { ClipboardList, Map, Users, History, Activity, PanelLeft, Leaf } from "lucide-react";
import OptimizePage from "./pages/OptimizePage";
import GroupsPage from "./pages/GroupsPage";
import AssignPage from "./pages/AssignPage";
import LogsPage from "./pages/LogsPage";
import StatusPage from "./pages/StatusPage";

// --- SHADCN UI ---
import { Toaster } from "@/components/ui/toaster";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils"; // Pastikan kamu punya file ini (standar shadcn)

// --- Logo & Navigasi ---
const navLinks = [
  { to: "/", label: "Optimasi", icon: Map },
  { to: "/groups", label: "Manajemen Grup", icon: ClipboardList },
  { to: "/assign", label: "Penugasan", icon: Users },
  { to: "/status", label: "Status Lapangan", icon: Activity }, // Ganti Wrench jadi Activity
  { to: "/logs", label: "Histori", icon: History },
];

// Komponen Logo SVG baru
function AppLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center w-10 h-10 bg-green-600 rounded-lg text-white", className)}>
      <Leaf className="w-6 h-6" />
    </div>
  );
}

function SidebarNav() {
  const linkClasses = "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors";
  const activeClasses = "bg-primary text-primary-foreground font-semibold";
  const inactiveClasses = "text-muted-foreground hover:bg-muted hover:text-foreground";

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(linkClasses, isActive ? activeClasses : inactiveClasses);

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="hidden md:flex flex-col w-64 border-r bg-muted/40 h-screen">
        <div className="flex items-center gap-3 h-16 border-b px-6">
          <AppLogo />
          <h1 className="text-xl font-bold tracking-tight text-green-700">Armada Hijau</h1>
        </div>
        <nav className="flex-1 flex flex-col gap-1 p-4">
          {navLinks.map((link) => (
            <Tooltip key={link.to}>
              <TooltipTrigger asChild>
                <NavLink to={link.to} end={link.to === "/"} className={navClass}>
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right">{link.label}</TooltipContent>
            </Tooltip>
          ))}
        </nav>
      </aside>
    </TooltipProvider>
  );
}

function MobileHeader() {
  const location = useLocation();
  const currentPage = navLinks.find(link => link.to === location.pathname) ?? { label: "Dashboard" };

  return (
    <header className="md:hidden flex items-center h-14 px-4 border-b bg-background sticky top-0 z-10">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="mr-4">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          {/* Tampilkan Sidebar di dalam Sheet */}
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 h-16 border-b px-6">
              <AppLogo />
              <h1 className="text-xl font-bold tracking-tight text-green-700">Armada Hijau</h1>
            </div>
            <nav className="flex-1 flex flex-col gap-1 p-4">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )
                  }
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </SheetContent>
      </Sheet>
      <h2 className="font-semibold text-lg">{currentPage.label}</h2>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        <SidebarNav />
        <div className="flex-1 flex flex-col h-screen overflow-y-auto">
          <MobileHeader />
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/" element={<OptimizePage />} />
              <Route path="/groups" element={<GroupsPage />} />
              <Route path="/assign" element={<AssignPage />} />
              <Route path="/status" element={<StatusPage />} />
              <Route path="/logs" element={<LogsPage />} />
            </Routes>
          </main>
        </div>
      </div>
      {/* PASANG TOASTER DI SINI! */}
      <Toaster />
    </div>
  );
}
