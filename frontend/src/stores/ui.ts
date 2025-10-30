// src/stores/ui.ts
import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

// 1. Tambahkan state baru ke 'interface'
interface UIState {
  maxVehicles: number
  setMaxVehicles: (n: number) => void
  selected: Set<string>
  setSelected: (s: Set<string>) => void

  isSidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const useUI = create(
  persist<UIState>(
    (set) => ({
      maxVehicles: 5,
      setMaxVehicles: (n) => set({ maxVehicles: n }),
      selected: new Set<string>(),
      setSelected: (s) => set({ selected: s }),

      isSidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
    }),
    {
      name: "meta-vrp-ui-storage",
      storage: createJSONStorage(() => localStorage), // Ganti ke localStorage agar lebih permanen

      partialize: (state) => ({
        maxVehicles: state.maxVehicles,
        isSidebarCollapsed: state.isSidebarCollapsed, // <-- TAMBAHKAN INI
      }),
    }
  )
)
