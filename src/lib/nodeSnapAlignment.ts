import type { Node, NodeChange } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { nodeLayoutDimensions } from "@/lib/nodeLayout";

/** 画布坐标系下的吸附阈值（像素与缩放无关，与节点 position 同单位） */
const SNAP_PX = 14;

type Rect = { left: number; right: number; top: number; bottom: number; cx: number; cy: number };

function toRect(n: Node<FlowNodeData>): Rect {
  const { w, h } = nodeLayoutDimensions(n);
  const x = n.position.x;
  const y = n.position.y;
  return {
    left: x,
    right: x + w,
    top: y,
    bottom: y + h,
    cx: x + w / 2,
    cy: y + h / 2,
  };
}

function pickBestDelta(candidates: number[], threshold: number): number {
  let best = 0;
  let bestAbs = threshold + 1;
  for (const d of candidates) {
    const a = Math.abs(d);
    if (a <= threshold && a < bestAbs) {
      bestAbs = a;
      best = d;
    }
  }
  return best;
}

/**
 * 对本次 position 变更做「相对其他节点」的边/中心对齐吸附；多选拖拽时按整体外接矩形对齐。
 */
export function snapNodePositionChanges(
  changes: NodeChange<Node<FlowNodeData>>[],
  nodes: Node<FlowNodeData>[],
): NodeChange<Node<FlowNodeData>>[] {
  const posIdx: number[] = [];
  const movingIds = new Set<string>();

  changes.forEach((c, i) => {
    if (c.type !== "position" || !c.position) return;
    /** 仅用户拖拽产生的 position 带 dragging；撤销/父级展开等不走吸附 */
    if (typeof (c as { dragging?: boolean }).dragging !== "boolean") return;
    posIdx.push(i);
    movingIds.add(c.id);
  });

  if (movingIds.size === 0) return changes;

  const proposed = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    proposed.set(n.id, { x: n.position.x, y: n.position.y });
  }
  for (const i of posIdx) {
    const c = changes[i] as Extract<NodeChange<Node<FlowNodeData>>, { type: "position" }>;
    proposed.set(c.id, { x: c.position!.x, y: c.position!.y });
  }

  const firstMoving = nodes.find((n) => movingIds.has(n.id));
  if (!firstMoving) return changes;
  const scopeParent = firstMoving.parentId ?? null;
  for (const id of movingIds) {
    const n = nodes.find((x) => x.id === id);
    if (!n || (n.parentId ?? null) !== scopeParent) {
      return changes;
    }
  }

  const snapTargets: Rect[] = [];
  for (const n of nodes) {
    if (movingIds.has(n.id)) continue;
    if ((n.parentId ?? null) !== scopeParent) continue;
    snapTargets.push(toRect(n));
  }
  if (snapTargets.length === 0) return changes;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const id of movingIds) {
    const n = nodes.find((x) => x.id === id);
    if (!n) continue;
    const { w, h } = nodeLayoutDimensions(n);
    const p = proposed.get(id)!;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + w);
    maxY = Math.max(maxY, p.y + h);
  }

  if (!Number.isFinite(minX)) return changes;

  const bboxW = maxX - minX;
  const bboxH = maxY - minY;

  const dxCandidates: number[] = [];
  const dyCandidates: number[] = [];

  for (const t of snapTargets) {
    dxCandidates.push(
      t.left - minX,
      t.right - minX,
      t.left - maxX,
      t.right - maxX,
      t.cx - (minX + bboxW / 2),
    );
    dyCandidates.push(
      t.top - minY,
      t.bottom - minY,
      t.top - maxY,
      t.bottom - maxY,
      t.cy - (minY + bboxH / 2),
    );
  }

  const dx = pickBestDelta(dxCandidates, SNAP_PX);
  const dy = pickBestDelta(dyCandidates, SNAP_PX);

  if (dx === 0 && dy === 0) return changes;

  const out = changes.slice();
  for (const i of posIdx) {
    const c = out[i] as Extract<NodeChange<Node<FlowNodeData>>, { type: "position" }>;
    const p = c.position!;
    out[i] = {
      ...c,
      position: {
        x: p.x + dx,
        y: p.y + dy,
      },
    };
  }
  return out;
}
