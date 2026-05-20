import { useEffect, useMemo, useState } from "react";
import { useStore } from "@xyflow/react";
import { useProjectStore } from "@/store/projectStore";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { normalizeConnection, validateConnection } from "@/lib/flowConnectionPolicy";

export type FlowConnectHintState = {
  x: number;
  y: number;
  message: string;
  valid: boolean | null;
};

const POINTER_OFFSET = 12;

/** 拖拽连线时根据当前悬停目标生成提示文案 */
export function useFlowConnectHint(): FlowConnectHintState | null {
  const pendingAnchor = useCanvasUiStore((s) => s.pendingAnchorConnection);
  const inProgress = useStore((s) => s.connection.inProgress);
  const fromNode = useStore((s) => s.connection.fromNode);
  const toNode = useStore((s) => s.connection.toNode);
  const fromHandle = useStore((s) => s.connection.fromHandle);
  const toHandle = useStore((s) => s.connection.toHandle);

  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!inProgress) return;
    const onMove = (e: MouseEvent) => setPointer({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [inProgress]);

  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const isGraphRunning = useProjectStore((s) => s.isGraphRunning);

  return useMemo(() => {
    if (!inProgress || !fromNode || isGraphRunning || pendingAnchor) return null;

    const x = pointer.x + POINTER_OFFSET;
    const y = pointer.y + POINTER_OFFSET;

    if (!toNode) {
      return {
        x,
        y,
        message: "拖到目标节点的输入锚点 (+)",
        valid: null,
      };
    }

    const pickHandleId = (h: unknown): string | null => {
      if (h == null) return null;
      if (typeof h === "string") return h;
      if (typeof h === "object" && h !== null && "id" in h) {
        return String((h as { id: string }).id);
      }
      return null;
    };

    const verdict = validateConnection(
      normalizeConnection({
        source: fromNode.id,
        target: toNode.id,
        sourceHandle: pickHandleId(fromHandle),
        targetHandle: pickHandleId(toHandle),
      }),
      nodes,
      edges,
    );

    if (verdict.ok) {
      return { x, y, message: "松开以建立连线", valid: true };
    }
    return { x, y, message: verdict.reason, valid: false };
  }, [
    inProgress,
    fromNode,
    toNode,
    fromHandle,
    toHandle,
    pointer.x,
    pointer.y,
    nodes,
    edges,
    isGraphRunning,
    pendingAnchor,
  ]);
}
