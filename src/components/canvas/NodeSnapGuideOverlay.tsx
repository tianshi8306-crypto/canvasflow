import { createPortal } from "react-dom";
import { useReactFlow } from "@xyflow/react";
import { useCanvasUiStore } from "@/store/canvasUiStore";

/**
 * 节点对齐吸附时显示智能参考线（横/竖，最多各一条）。
 */
export function NodeSnapGuideOverlay() {
  const visual = useCanvasUiStore((s) => s.nodeSnapVisual);
  const guidesEnabled = useCanvasUiStore((s) => s.snapGuidesEnabled);
  const { flowToScreenPosition } = useReactFlow();

  if (!guidesEnabled || !visual?.guides.length || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <>
      {visual.guides.map((g, i) => {
        if (g.axis === "y") {
          const left = flowToScreenPosition({ x: g.flowMin, y: g.flowPos });
          const right = flowToScreenPosition({ x: g.flowMax, y: g.flowPos });
          const lineLeft = Math.min(left.x, right.x);
          const lineWidth = Math.max(8, Math.abs(right.x - left.x));
          const mid = flowToScreenPosition({
            x: (g.flowMin + g.flowMax) / 2,
            y: g.flowPos,
          });
          return (
            <span key={`h-${i}`}>
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
            </span>
          );
        }

        const top = flowToScreenPosition({ x: g.flowPos, y: g.flowMin });
        const bottom = flowToScreenPosition({ x: g.flowPos, y: g.flowMax });
        const lineTop = Math.min(top.y, bottom.y);
        const lineHeight = Math.max(8, Math.abs(bottom.y - top.y));
        const mid = flowToScreenPosition({
          x: g.flowPos,
          y: (g.flowMin + g.flowMax) / 2,
        });
        return (
          <span key={`v-${i}`}>
            <div
              className="node-snap-guide-line node-snap-guide-line--vertical"
              style={{
                position: "fixed",
                left: top.x,
                top: lineTop,
                width: 1,
                height: lineHeight,
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
          </span>
        );
      })}
    </>,
    document.body,
  );
}
