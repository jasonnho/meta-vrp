// src/stores/status.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type PerVehiclePick = Record<string, { status?: string }>;
type PerStepPick    = Record<string, { status?: string; reason?: string }>;

type StatusUI = {
  selectedJobId: string;
  perVeh: PerVehiclePick;
  perStep: PerStepPick;

  setSelectedJobId: (id: string) => void;
  setPerVeh: (updater: (s: PerVehiclePick) => PerVehiclePick) => void;
  setPerStep: (updater: (s: PerStepPick) => PerStepPick) => void;
  clearPicks: () => void;
};

export const useStatusUI = create<StatusUI>()(
  persist(
    (set, get) => ({
      selectedJobId: "",
      perVeh: {},
      perStep: {},

      setSelectedJobId: (id) => set({ selectedJobId: id }),
      setPerVeh: (updater) => set((s) => ({ perVeh: updater(s.perVeh) })),
      setPerStep: (updater) => set((s) => ({ perStep: updater(s.perStep) })),
      clearPicks: () => set({ perVeh: {}, perStep: {} }),
    }),
    {
      name: "meta-vrp-status-ui",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);
