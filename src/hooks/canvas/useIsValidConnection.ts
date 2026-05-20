import { useProjectStore } from "@/store/projectStore";
import { normalizeConnection, validateConnection } from "@/lib/flowConnectionPolicy";
import type { Connection, Edge } from "@xyflow/react";

export function useIsValidConnection() {
  const isGraphRunning = useProjectStore((s) => s.isGraphRunning);

  const isValidConnection = (c: Edge | Connection) => {
    if (isGraphRunning) return false;
    const state = useProjectStore.getState();
    return validateConnection(normalizeConnection(c), state.nodes, state.edges).ok;
  };

  return { isValidConnection, isGraphRunning };
}
