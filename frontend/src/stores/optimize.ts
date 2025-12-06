import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { OptimizeResponse } from '../types'

type OptimizeMem = {
  lastResult?: OptimizeResponse
  lastRunAt?: string
  lastPayload?: { num_vehicles: number; selected_node_ids: string[] }

  setLastResult: (r: OptimizeResponse, payload: OptimizeMem['lastPayload']) => void
  clearLastResult: () => void
}

export const useOptimizeMem = create<OptimizeMem>()(
  persist(
    (set) => ({
      lastResult: undefined,
      lastRunAt: undefined,
      lastPayload: undefined,
      setLastResult: (r, payload) =>
        set({
          lastResult: r,
          lastRunAt: new Date().toISOString(),
          lastPayload: payload,
        }),
      clearLastResult: () =>
        set({ lastResult: undefined, lastRunAt: undefined, lastPayload: undefined }),
    }),
    {
      name: 'meta-vrp-optimize-mem',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
)
