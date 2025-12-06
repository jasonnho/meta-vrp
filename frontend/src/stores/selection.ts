import { create } from "zustand";

type SelState = {
    selectedNodeIds: string[];
    setSelected: (ids: string[]) => void;
    addMany: (ids: string[]) => void;
    clear: () => void;
};

export const useSelection = create<SelState>((set) => ({
    selectedNodeIds: [],
    setSelected: (ids) => set({ selectedNodeIds: Array.from(new Set(ids)) }),
    addMany: (ids) =>
        set((s) => ({
            selectedNodeIds: Array.from(
                new Set([...s.selectedNodeIds, ...ids]),
            ),
        })),
    clear: () => set({ selectedNodeIds: [] }),
}));
