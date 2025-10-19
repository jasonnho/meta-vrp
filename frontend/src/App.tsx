import { NavLink, Route, Routes } from "react-router-dom";
import { ClipboardList, Map, Users, Wrench, History } from "lucide-react";
import OptimizePage from "./pages/OptimizePage";
import GroupsPage from "./pages/GroupsPage";
import AssignPage from "./pages/AssignPage";
import LogsPage from "./pages/LogsPage";
import StatusPage from "./pages/StatusPage";
import { Toaster } from "@/components/ui/toaster"

function Sidebar() {
  const link =
    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800";
  const active = "bg-zinc-200 dark:bg-zinc-700 font-medium";

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `${link} ${isActive ? active : ""}`;

  return (
    <aside className="w-60 border-r border-zinc-200 dark:border-zinc-800 p-3">
      <h1 className="text-xl font-semibold mb-3">META-VRP</h1>
      <nav className="flex flex-col gap-1">
        <NavLink to="/" end className={navClass}>
          <Map size={16} /> Optimize
        </NavLink>
        <NavLink to="/groups" className={navClass}>
          <ClipboardList size={16} /> Groups
        </NavLink>
        <NavLink to="/assign" className={navClass}>
          <Users size={16} /> Assign
        </NavLink>
        <NavLink to="/status" className={navClass}>
          <Wrench size={16} /> Route Status
        </NavLink>
        <NavLink to="/logs" className={navClass}>
          <History size={16} /> Logs
        </NavLink>
      </nav>
    </aside>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4">
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
  );
}
