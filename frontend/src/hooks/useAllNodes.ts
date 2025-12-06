import { useQuery } from '@tanstack/react-query'
import { Api } from '../lib/api' // <-- Kembalikan ke Api
import type { Node } from '../types'

export function useAllNodes() {
  return useQuery<Node[]>({
    queryKey: ['nodes'],
    queryFn: Api.listNodes, // <-- Kembalikan ke Api.listNodes
    staleTime: 60_000,
  })
}
