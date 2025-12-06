import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

type PerRVSelection = Record<
  string, // routeVehicleId as string
  { operatorId?: string; vehicleId?: string; status?: string }
>

type NewOp = { name: string; phone: string; active: boolean }
type NewVeh = { plate: string; capacityL: number; active: boolean }

type AssignUIState = {
  selectedJobId: string
  perRV: PerRVSelection

  showAddOp: boolean
  newOp: NewOp

  showAddVeh: boolean
  newVeh: NewVeh

  // setters
  setSelectedJobId: (id: string) => void
  setPerRV: (updater: (s: PerRVSelection) => PerRVSelection) => void
  clearPerRV: () => void

  setShowAddOp: (v: boolean) => void
  setNewOp: (updater: (s: NewOp) => NewOp) => void

  setShowAddVeh: (v: boolean) => void
  setNewVeh: (updater: (s: NewVeh) => NewVeh) => void
}

export const useAssignUI = create<AssignUIState>()(
  persist(
    (set) => ({
      selectedJobId: '',
      perRV: {},

      showAddOp: false,
      newOp: { name: '', phone: '', active: true },

      showAddVeh: false,
      newVeh: { plate: '', capacityL: 0, active: true },

      setSelectedJobId: (id) => set({ selectedJobId: id }),
      setPerRV: (updater) => set((s) => ({ perRV: updater(s.perRV) })),
      clearPerRV: () => set({ perRV: {} }),

      setShowAddOp: (v) => set({ showAddOp: v }),
      setNewOp: (updater) => set((s) => ({ newOp: updater(s.newOp) })),

      setShowAddVeh: (v) => set({ showAddVeh: v }),
      setNewVeh: (updater) => set((s) => ({ newVeh: updater(s.newVeh) })),
    }),
    {
      name: 'meta-vrp-assign-ui',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
)
