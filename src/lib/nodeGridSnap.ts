import type { Node, NodeChange } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";

export function snapScalarToGrid(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

export function snapPointToGrid(
  pos: { x: number; y: number },
  step: number,
): { x: number; y: number } {
  return {
    x: snapScalarToGrid(pos.x, step),
    y: snapScalarToGrid(pos.y, step),
  };
}

/** 拖拽结束时将落点吸附到步长网格（弱吸附，不与智能参考线竞争） */
export function applyGridSnapToPositionChanges(
  changes: NodeChange<Node<FlowNodeData>>[],
  step: number,
): NodeChange<Node<FlowNodeData>>[] {
  if (step <= 0) return changes;
  const out = changes.slice();
  for (let i = 0; i < out.length; i++) {
    const c = out[i]!;
    if (c.type !== "position") continue;
    const dragging = (c as { dragging?: boolean }).dragging;
    if (dragging !== false) continue;
    const p = c.position;
    if (!p) continue;
    out[i] = {
      ...c,
      position: snapPointToGrid(p, step),
    };
  }
  return out;
}
