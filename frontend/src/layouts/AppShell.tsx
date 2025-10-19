import { Outlet, Link } from "react-router-dom"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { AppNav } from "@/components/app-nav"
import { Menu } from "lucide-react"

// Shell: sidebar tetap di desktop, dialog-nav untuk mobile.
export default function AppShell() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open navigation</span>
            </Button>
            <Link to="/" className="font-semibold tracking-tight">
              Meta-VRP
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {/* tempat search mini nanti */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Body: Sidebar + Main */}
      <div className="container mx-auto grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 px-4 py-4">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:block">
          <div className="sticky top-16">
            <AppNav />
          </div>
        </aside>

        {/* Main content */}
        <main className="min-h-[calc(100vh-4rem-2rem)] rounded-xl border bg-card">
          {/* inner wrapper biar scroll nyaman tanpa ganggu topbar */}
          <div className="h-full overflow-auto p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile nav dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Navigasi</DialogTitle>
          </DialogHeader>
          <AppNav onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
