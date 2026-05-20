import { useLayoutEffect, useState } from "react";
import { getBezierPath, Position, useReactFlow } from "@xyflow/react";
import { getAnchorHandleFlowPosition } from "@/lib/anchorHandleGeometry";
import { useCanvasUiStore } from "@/store/canvasUiStore";
import { useProjectStore } from "@/store/projectStore";

/**
 * 拖线松手在空白处后，保持「锚点 → 松手位置」的悬挂预览线，直到选菜单或取消。
 */
export function PendingConnectionOverlay() {
  const pending = useCanvasUiStore((s) => s.pendingAnchorConnection);
  const nodes = useProjectStore((s) => s.nodes);
  const viewport = useProjectStore((s) => s.viewport);
  const { getNode, flowToScreenPosition } = useReactFlow();
  const [geom, setGeom] = useState<{
    path: string;
    endX: number;
    endY: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!pending) {
      setGeom(null);
      return;
    }
    const node = getNode(pending.anchorNodeId);
    if (!node) {
      setGeom(null);
      return;
    }

    const handle = getAnchorHandleFlowPosition(node, pending.handleType);
    const sourceFlow =
      pending.handleType === "source"
        ? { x: handle.x, y: handle.y }
        : { x: pending.releaseFlow.x, y: pending.releaseFlow.y };
    const targetFlow =
      pending.handleType === "source"
        ? { x: pending.releaseFlow.x, y: pending.releaseFlow.y }
        : { x: handle.x, y: handle.y };
    const sourcePosition = pending.handleType === "source" ? Position.Right : Position.Right;
    const targetPosition = pending.handleType === "source" ? Position.Left : Position.Left;

    const s = flowToScreenPosition(sourceFlow);
    const t = flowToScreenPosition(targetFlow);

    const [path] = getBezierPath({
      sourceX: s.x,
      sourceY: s.y,
      sourcePosition,
      targetX: t.x,
      targetY: t.y,
      targetPosition,
    });

    setGeom({ path, endX: t.x, endY: t.y });
  }, [pending, nodes, viewport, flowToScreenPosition, getNode]);

  if (!geom) return null;

  return (
    <svg
      className="pending-connection-overlay"
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 11,
        overflow: "visible",
      }}
    >
      <path d={geom.path} className="pending-connection-line" fill="none" />
      <circle cx={geom.endX} cy={geom.endY} r={4} className="pending-connection-line-end" />
    </svg>
  );
}
