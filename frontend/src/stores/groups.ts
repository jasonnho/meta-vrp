import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type GroupModal =
  | { mode: "closed" }
  | { mode: "new" }
  | { mode: "edit"; id: string };

type GroupsUIState = {
  modal: GroupModal;
  openNew: () => void;
  openEdit: (id: string) => void;
  close: () => void;
};

export const useGroupsUI = create<GroupsUIState>()(
  persist(
    (set) => ({
      modal: { mode: "closed" },
      openNew: () => set({ modal: { mode: "new" } }),
      openEdit: (id) => set({ modal: { mode: "edit", id } }),
      close: () => set({ modal: { mode: "closed" } }),
    }),
    {
      name: "meta-vrp-groups-ui",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);
