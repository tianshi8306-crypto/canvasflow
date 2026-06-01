import { useProjectStore } from "@/store/projectStore";
import { normalizeConnection, validateConnection } from "@/lib/flowConnectionPolicy";
import type { Connection, Edge } from "@xyflow/react";

export function useIsValidConnection() {
  const isGraphRunning = useProjectStore((s) => s.isGraphRunning);

  const isValidConnection = (c: Edge | Connection) => {
    if (isGraphRunning) return false;
    const state = useProjectStore.getState();
    const conn =
      "source" in c && "target" in c
        ? {
            source: c.source,
            target: c.target,
            sourceHandle: c.sourceHandle ?? null,
            targetHandle: c.targetHandle ?? null,
          }
        : c;
    return validateConnection(normalizeConnection(conn), state.nodes, state.edges).ok;
  };

  return { isValidConnection, isGraphRunning };
}
