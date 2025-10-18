// src/stores/ui.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type UIState = {
  selected: Set<string>;
  maxVehicles: number;

  setSelected: (s: Set<string>) => void;
  setMaxVehicles: (n: number) => void;
};

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      selected: new Set<string>(),
      maxVehicles: 0,
      setSelected: (s) => set({ selected: s }),
      setMaxVehicles: (n) => set({ maxVehicles: n }),
    }),
    {
      name: "meta-vrp-ui",
      // Gunakan replacer/reviver untuk serialize Set<string>
      storage: createJSONStorage<UIState>(() => localStorage, {
        replacer: (_key, value) => {
          if (value instanceof Set) {
            return { __zSet: true, v: Array.from(value) };
          }
          return value;
        },
        reviver: (_key, value) => {
          if (value && typeof value === "object" && (value as any).__zSet) {
            return new Set<string>((value as any).v);
          }
          return value;
        },
      }),
      version: 1,
    }
  )
);
