import { useMemo } from "react";
import { useProjectStore } from "@/store/projectStore";
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";

export type UpstreamNodeCandidate = {
  id: string;
  type: string;
  label: string;
};

/**
 * Returns upstream nodes connected to the given node via incoming edges.
 */
export function useUpstreamNodeCandidates(nodeId: string): UpstreamNodeCandidate[] {
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);

  return useMemo(() => {
    const upstreamEdgeSources = [...new Set(
      edges
        .filter((edge) => edge.target === nodeId)
        .map((edge) => edge.source)
        .filter((sourceId) => sourceId !== nodeId)
    )];

    return upstreamEdgeSources
      .map((sourceId) => {
        const node = nodes.find((n: Node<FlowNodeData>) => n.id === sourceId);
        if (!node) return null;
        return {
          id: node.id,
          type: node.type ?? "unknown",
          label: node.data?.label ?? node.id,
        };
      })
      .filter((n): n is UpstreamNodeCandidate => n !== null);
  }, [nodes, edges, nodeId]);
}
