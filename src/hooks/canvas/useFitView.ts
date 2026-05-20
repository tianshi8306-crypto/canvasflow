import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";

export function useFitView() {
  const reactFlow = useReactFlow();

  const fitViewToNode = useCallback(
    async (nodeId: string) => {
      try {
        await reactFlow.fitView({
          nodes: [{ id: nodeId }],
          padding: 0.06,
          duration: 420,
          minZoom: 0.15,
          maxZoom: 3,
        });
      } catch {
        /* fitView 在极宽/极窄画布上可能失败，忽略 */
      }
    },
    [reactFlow],
  );

  return { fitViewToNode };
}
