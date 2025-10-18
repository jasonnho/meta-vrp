import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { JobStatus } from "../types";

type LogsUIState = {
  status: "ALL" | JobStatus;
  fromDate: string; // "YYYY-MM-DD" or ""
  toDate: string;   // "YYYY-MM-DD" or ""

  setStatus: (s: LogsUIState["status"]) => void;
  setFromDate: (s: string) => void;
  setToDate: (s: string) => void;
  resetFilters: () => void;
};

export const useLogsUI = create<LogsUIState>()(
  persist(
    (set) => ({
      status: "ALL",
      fromDate: "",
      toDate: "",

      setStatus: (s) => set({ status: s }),
      setFromDate: (s) => set({ fromDate: s }),
      setToDate: (s) => set({ toDate: s }),
      resetFilters: () => set({ status: "ALL", fromDate: "", toDate: "" }),
    }),
    {
      name: "meta-vrp-logs-ui",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);
