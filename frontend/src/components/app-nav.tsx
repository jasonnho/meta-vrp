import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Home, List, Activity, Users, ClipboardList } from "lucide-react"

type Item = { to: string; label: string; icon: React.ComponentType<{className?: string}> }

const ITEMS: Item[] = [
  { to: "/",        label: "Optimize", icon: Home },
  { to: "/logs",    label: "Logs",     icon: List },
  { to: "/status",  label: "Status",   icon: Activity },
  { to: "/groups",  label: "Groups",   icon: Users },
  { to: "/assign",  label: "Assign",   icon: ClipboardList },
]

export function AppNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            )
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
