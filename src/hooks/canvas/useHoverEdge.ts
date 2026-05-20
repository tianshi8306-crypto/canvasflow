import { useCallback, useState } from "react";
import type { Edge } from "@xyflow/react";
import { isEdgeDisabled } from "@/lib/edgeState";
import type { EdgeHoverState } from "@/hooks/useEdgeViewModel";

interface UseHoverEdgeOptions {
  summarizeEdgePayload: (sourceId: string, targetId: string, disabled: boolean) => string;
}

export function useHoverEdge({ summarizeEdgePayload }: UseHoverEdgeOptions) {
  const [hoverEdge, setHoverEdge] = useState<EdgeHoverState | null>(null);

  const syncHoverEdge = useCallback(
    (clientX: number, clientY: number, edge: Edge) => {
      const disabled = isEdgeDisabled(edge);
      const summary = summarizeEdgePayload(edge.source, edge.target, disabled);
      setHoverEdge((prev) =>
        prev && prev.edgeId === edge.id
          ? { ...prev, x: clientX, y: clientY, summary, disabled }
          : {
              edgeId: edge.id,
              sourceId: edge.source,
              targetId: edge.target,
              x: clientX,
              y: clientY,
              summary,
              disabled,
            },
      );
    },
    [summarizeEdgePayload],
  );

  return { hoverEdge, setHoverEdge, syncHoverEdge };
}
