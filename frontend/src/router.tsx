import { createBrowserRouter } from "react-router-dom"
import AppShell from "@/layouts/AppShell"
import OptimizePage from "@/pages/OptimizePage"
import LogsPage from "@/pages/LogsPage"
import StatusPage from "@/pages/StatusPage"
import GroupsPage from "@/pages/GroupsPage"
import AssignPage from "@/pages/AssignPage"

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <OptimizePage /> },
      { path: "logs", element: <LogsPage /> },
      { path: "status", element: <StatusPage /> },
      { path: "groups", element: <GroupsPage /> },
      { path: "assign", element: <AssignPage /> },
    ],
  },
])
