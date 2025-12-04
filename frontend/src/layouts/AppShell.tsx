// src/layouts/AppShell.tsx
import { Outlet, NavLink, useLocation } from "react-router-dom"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"
import { Menu, Leaf, ClipboardList, Map, Users, History, Activity, PanelLeft, PanelRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import { useUI } from "../stores/ui"

const navLinks = [
  { to: "/", label: "Optimasi", icon: Map },
  { to: "/groups", label: "Manajemen Grup", icon: ClipboardList },
  { to: "/assign", label: "Penugasan", icon: Users },
  { to: "/status", label: "Status Lapangan", icon: Activity },
  { to: "/logs", label: "Histori", icon: History },
  { to: "/editor", label: "Editor Peta", icon: Leaf },
];

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
      <span>Armada Hijau</span>
    </NavLink>
  );
}

const navContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};
const navItemVariants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0 },
};

function AppNav({ isCollapsed }: { isCollapsed: boolean }) {
  const { pathname } = useLocation();
  const { toggleSidebar } = useUI();

  return (
    <motion.nav
      className="grid items-start gap-1.5"
      variants={navContainerVariants}
      initial="hidden"
      animate="show"
      key={isCollapsed ? 'collapsed' : 'expanded'}
    >
      {navLinks.map((link) => {
        const isActive = pathname === link.to;
        return (
          <motion.div
            key={link.to}
            variants={navItemVariants}
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <NavLink
                  to={link.to}
                  className={cn(
                    "flex items-center h-10 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-green-600 text-white font-semibold shadow-md"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    isCollapsed ? "justify-center w-10" : "px-3"
                  )}
                >
                  <link.icon className="h-4 w-4 flex-shrink-0" />

                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0, transition: { duration: 0.2, delay: 0.15 } }}
                        exit={{ opacity: 0, x: -10, transition: { duration: 0.1 } }}
                        className="whitespace-nowrap ml-3"
                      >
                        {link.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </NavLink>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  <p>{link.label}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </motion.div>
        );
      })}

      <motion.div
        variants={navItemVariants}
        whileHover={{ x: 3 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        className="mt-4 pt-4 border-t"
      >
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              onClick={toggleSidebar}
              className={cn(
                "flex items-center h-10 w-full rounded-lg text-sm transition-colors text-muted-foreground hover:bg-muted hover:text-foreground",
                isCollapsed ? "justify-center w-10" : "px-3"
              )}
            >
              {isCollapsed ? <PanelRight className="h-4 w-4 flex-shrink-0" /> : <PanelLeft className="h-4 w-4 flex-shrink-0" />}

              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0, transition: { duration: 0.2, delay: 0.15 } }}
                    exit={{ opacity: 0, x: -10, transition: { duration: 0.1 } }}
                    className="whitespace-nowrap ml-3"
                  >
                    Ciutkan
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right">
              <p>Perluas sidebar</p>
            </TooltipContent>
          )}
        </Tooltip>
      </motion.div>
    </motion.nav>
  );
}

export default function AppShell() {
  const [open, setOpen] = useState(false)
  const { isSidebarCollapsed } = useUI();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">

      <header className="z-50 border-b border-primary/10 bg-gradient-to-r from-primary/5 via-background to-primary/5 backdrop-blur-xl flex-shrink-0">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">

          <div className="flex items-center gap-2">
            {/* Tombol Menu Mobile */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="md:hidden"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Buka menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex flex-col p-0 w-64">
                <div className="p-4 border-b">
                  <AppLogo />
                </div>
                {/* hilangin scroll horizontal di mobile sidebar */}
                <div className="p-4 overflow-y-auto overflow-x-hidden app-scroll">
                  <AppNav isCollapsed={false} />
                </div>
              </SheetContent>
            </Sheet>

            {/* Logo Desktop */}
            <div className="hidden md:flex items-center gap-2">
              <AppLogo />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className={cn(
        "container mx-auto flex-1 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 px-4 py-4 overflow-hidden",
        "transition-[grid-template-columns] duration-300 ease-in-out",
        isSidebarCollapsed && "md:grid-cols-[72px_1fr]"
      )}>

        {/* hilangin scroll horizontal di sidebar desktop */}
        <aside
          className={cn(
            "hidden md:block h-full overflow-y-auto overflow-x-hidden app-scroll",
            "bg-background/80 backdrop-blur"
          )}
        >
          <div className="sticky top-16">
            <AppNav isCollapsed={isSidebarCollapsed} />
          </div>
        </aside>

        <main className="h-full overflow-y-auto rounded-2xl border bg-gradient-to-br from-card via-card to-primary/[0.02] app-scroll shadow-sm">
          <div className="p-5 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>

      <footer className="flex-shrink-0 border-t border-primary/10 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent">
        <div className="container mx-auto flex h-12 items-center justify-center px-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} MetaVRP Project • Dibuat untuk Proyek Capstone
          </p>
        </div>
      </footer>
    </div>
  );
}
