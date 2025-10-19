// src/AppShell.tsx
import { Outlet, Link } from "react-router-dom"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { AppNav } from "@/components/app-nav"
import { Menu, Leaf } from "lucide-react"
import { cn } from "@/lib/utils"

function AppLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center w-8 h-8 bg-green-600 rounded-lg text-white", className)}>
      <Leaf className="w-5 h-5" />
    </div>
  )
}

export default function AppShell() {
  const [open, setOpen] = useState(false)

  return (
    // 1. Root: Dibuat flex column, tinggi 100vh, dan overflow hidden
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">

      {/* 2. Topbar: Tidak sticky, tapi z-index tinggi. 'flex-shrink-0' agar tidak menyusut */}
      <header className="z-50 border-b bg-background/80 backdrop-blur flex-shrink-0">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open navigation</span>
            </Button>
            <Link to="/" className="flex items-center gap-2.5">
              <AppLogo />
              <span className="text-lg font-bold tracking-tight text-green-700">
                Armada Hijau
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* 3. Body: 'flex-1' (isi sisa space) dan 'overflow-hidden' */}
      <div className="container mx-auto flex-1 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 px-4 py-4 overflow-hidden">

        {/* 4. Sidebar: 'h-full' dan 'overflow-y-auto' agar bisa scroll jika nav panjang */}
        <aside className="hidden md:block h-full overflow-y-auto">
          {/* 'sticky top-16' (14h header + 4py) agar nav tetap di atas saat sidebar di-scroll */}
          <div className="sticky top-16">
            <AppNav />
          </div>
        </aside>

        {/* 5. Main content: 'h-full' dan 'overflow-y-auto' (INI YANG SCROLL) */}
        <main className="h-full overflow-y-auto rounded-xl border bg-card">
          {/* Wrapper p-4/p-6 tetap di sini, di dalam area scroll */}
          <div className="p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile nav dialog (tidak berubah) */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2.5">
              <AppLogo />
              <span className="text-lg font-bold tracking-tight text-green-700">
                Armada Hijau
              </span>
            </DialogTitle>
          </DialogHeader>
          <AppNav onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
