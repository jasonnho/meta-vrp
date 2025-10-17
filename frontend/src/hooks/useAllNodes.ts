// src/hooks/useAllNodes.ts
import { useQuery } from "@tanstack/react-query";
import { Api } from "../lib/api";
import type { Node } from "../types";

export function useAllNodes() {
  return useQuery<Node[]>({
    queryKey: ["nodes"],
    queryFn: Api.listNodes,
    staleTime: 60_000,
  });
}
