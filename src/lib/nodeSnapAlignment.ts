import type { Node, NodeChange } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { nodeLayoutDimensions } from "@/lib/nodeLayout";
import { SIMPLE_ANCHOR_ALIGN_SNAP_PX } from "@/lib/simpleAnchorGeometry";

/** 边对齐吸附阈值 */
const SNAP_EDGE_PX = 14;

/** 水平中心（锚点连线）吸附阈值 */
const SNAP_CENTER_PX = SIMPLE_ANCHOR_ALIGN_SNAP_PX;

export type NodeSnapVisual = {
  /** 对齐参考线在 flow 坐标下的 y */
  flowY: number;
  flowXMin: number;
  flowXMax: number;
};

export type SnapNodePositionResult = {
  changes: NodeChange<Node<FlowNodeData>>[];
  visual: NodeSnapVisual | null;
};

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

function pickBestDelta(
  candidates: number[],
  threshold: number,
): { delta: number; abs: number } {
  let best = 0;
  let bestAbs = threshold + 1;
  for (const d of candidates) {
    const a = Math.abs(d);
    if (a <= threshold && a < bestAbs) {
      bestAbs = a;
      best = d;
    }
  }
  return { delta: best, abs: bestAbs };
}

/**
 * 对本次 position 变更做「相对其他节点」的边/中心对齐吸附；多选拖拽时按整体外接矩形对齐。
 */
export function snapNodePositionChanges(
  changes: NodeChange<Node<FlowNodeData>>[],
  nodes: Node<FlowNodeData>[],
): SnapNodePositionResult {
  const posIdx: number[] = [];
  const movingIds = new Set<string>();

  changes.forEach((c, i) => {
    if (c.type !== "position" || !c.position) return;
    if (typeof (c as { dragging?: boolean }).dragging !== "boolean") return;
    posIdx.push(i);
    movingIds.add(c.id);
  });

  if (movingIds.size === 0) {
    return { changes, visual: null };
  }

  const proposed = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    proposed.set(n.id, { x: n.position.x, y: n.position.y });
  }
  for (const i of posIdx) {
    const c = changes[i] as Extract<NodeChange<Node<FlowNodeData>>, { type: "position" }>;
    proposed.set(c.id, { x: c.position!.x, y: c.position!.y });
  }

  const firstMoving = nodes.find((n) => movingIds.has(n.id));
  if (!firstMoving) {
    return { changes, visual: null };
  }
  const scopeParent = firstMoving.parentId ?? null;
  for (const id of movingIds) {
    const n = nodes.find((x) => x.id === id);
    if (!n || (n.parentId ?? null) !== scopeParent) {
      return { changes, visual: null };
    }
  }

  const snapTargets: Rect[] = [];
  for (const n of nodes) {
    if (movingIds.has(n.id)) continue;
    if ((n.parentId ?? null) !== scopeParent) continue;
    snapTargets.push(toRect(n));
  }
  if (snapTargets.length === 0) {
    return { changes, visual: null };
  }

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

  if (!Number.isFinite(minX)) {
    return { changes, visual: null };
  }

  const bboxW = maxX - minX;
  const bboxH = maxY - minY;
  const movingCy = minY + bboxH / 2;

  const dxCandidates: number[] = [];
  const dyCandidates: number[] = [];
  const centerDyMeta: { delta: number; targetCy: number; target: Rect }[] = [];

  for (const t of snapTargets) {
    dxCandidates.push(
      t.left - minX,
      t.right - minX,
      t.left - maxX,
      t.right - maxX,
      t.cx - (minX + bboxW / 2),
    );
    const centerDelta = t.cy - movingCy;
    dyCandidates.push(
      t.top - minY,
      t.bottom - minY,
      t.top - maxY,
      t.bottom - maxY,
      centerDelta,
    );
    centerDyMeta.push({ delta: centerDelta, targetCy: t.cy, target: t });
  }

  const dxPick = pickBestDelta(dxCandidates, SNAP_EDGE_PX);
  const dyPick = pickBestDelta(dyCandidates, SNAP_CENTER_PX);

  const dx = dxPick.delta;
  const dy = dyPick.delta;

  if (dx === 0 && dy === 0) {
    return { changes, visual: null };
  }

  let visual: NodeSnapVisual | null = null;
  if (dyPick.abs > 0 && dyPick.abs <= SNAP_CENTER_PX) {
    const matched = centerDyMeta.find((m) => m.delta === dy);
    const flowY = matched?.targetCy ?? movingCy + dy;
    const xMin = Math.min(minX, ...(snapTargets.map((t) => t.left)));
    const xMax = Math.max(maxX, ...(snapTargets.map((t) => t.right)));
    visual = { flowY, flowXMin: xMin, flowXMax: xMax };
  }

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
  return { changes: out, visual };
}
