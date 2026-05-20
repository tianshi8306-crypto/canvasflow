import { createPortal } from "react-dom";
import { useReactFlow } from "@xyflow/react";
import { useCanvasUiStore } from "@/store/canvasUiStore";

/**
 * 节点水平中心吸附时：画布上显示十字参考线与对齐 y。
 */
export function NodeSnapGuideOverlay() {
  const visual = useCanvasUiStore((s) => s.nodeSnapVisual);
  const { flowToScreenPosition } = useReactFlow();

  if (!visual || typeof document === "undefined") {
    return null;
  }

  const left = flowToScreenPosition({ x: visual.flowXMin, y: visual.flowY });
  const right = flowToScreenPosition({ x: visual.flowXMax, y: visual.flowY });
  const mid = flowToScreenPosition({ x: (visual.flowXMin + visual.flowXMax) / 2, y: visual.flowY });

  const lineLeft = Math.min(left.x, right.x);
  const lineWidth = Math.max(8, Math.abs(right.x - left.x));

  return createPortal(
    <>
      <div
        className="node-snap-guide-line"
        style={{
          position: "fixed",
          left: lineLeft,
          top: left.y,
          width: lineWidth,
          height: 1,
          pointerEvents: "none",
          zIndex: 48,
        }}
        aria-hidden
      />
      <div
        className="anchor-crosshair node-snap-guide-crosshair"
        style={{
          position: "fixed",
          left: mid.x,
          top: mid.y,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 49,
        }}
        aria-hidden
      >
        <div className="anchor-crosshair-h" />
        <div className="anchor-crosshair-v" />
      </div>
    </>,
    document.body,
  );
}
