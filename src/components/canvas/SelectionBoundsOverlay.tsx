import { useLayoutEffect, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useProjectStore } from "@/store/projectStore";

type Props = { marqueeActive: boolean };

/** 多选时虚线包围盒（参考图一） */
export function SelectionBoundsOverlay({ marqueeActive }: Props) {
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const viewport = useProjectStore((s) => s.viewport);
  const { getNodesBounds, flowToScreenPosition } = useReactFlow();
  const [rect, setRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (selectedNodeIds.length < 2 || marqueeActive) {
       
      setRect(null);
      return;
    }
    try {
      const b = getNodesBounds(selectedNodeIds);
      const p1 = flowToScreenPosition({ x: b.x, y: b.y });
      const p2 = flowToScreenPosition({ x: b.x + b.width, y: b.y + b.height });
      const left = Math.min(p1.x, p2.x);
      const top = Math.min(p1.y, p2.y);
       
      setRect({
        left,
        top,
        width: Math.abs(p2.x - p1.x),
        height: Math.abs(p2.y - p1.y),
      });
    } catch {
       
      setRect(null);
    }
  }, [flowToScreenPosition, getNodesBounds, selectedNodeIds, viewport, marqueeActive]);

  if (!rect || rect.width < 4 || rect.height < 4) return null;

  return (
    <div
      className="selectionBoundsOverlay"
      style={{
        position: "fixed",
        left: rect.left - 6,
        top: rect.top - 6,
        width: rect.width + 12,
        height: rect.height + 12,
        pointerEvents: "none",
        zIndex: 12,
      }}
      aria-hidden
    >
      <div className="selectionBoundsDash" />
    </div>
  );
}
