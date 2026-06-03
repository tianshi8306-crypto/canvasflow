import type { Node, NodeChange } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { nodeLayoutDimensions } from "@/lib/nodeLayout";

/** 边/中心对齐吸附阈值（与 Figma 智能参考线接近） */
export const SNAP_ALIGN_THRESHOLD_PX = 12;
/** 中心对齐略宽阈值，拖拽时优先显示中心参考线 */
export const SNAP_CENTER_ALIGN_THRESHOLD_PX = 16;

export type SnapGuideLine =
  | { axis: "x"; flowPos: number; flowMin: number; flowMax: number }
  | { axis: "y"; flowPos: number; flowMin: number; flowMax: number };

export type NodeSnapVisual = {
  guides: SnapGuideLine[];
};

export type SnapNodePositionResult = {
  changes: NodeChange<Node<FlowNodeData>>[];
  visual: NodeSnapVisual | null;
};

type Rect = { left: number; right: number; top: number; bottom: number; cx: number; cy: number };

type SnapCandidate = {
  delta: number;
  guide: SnapGuideLine;
  kind: "edge" | "center";
};

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

function pickBestCandidate(
  candidates: SnapCandidate[],
  threshold: number,
  kind?: SnapCandidate["kind"],
): SnapCandidate | null {
  let best: SnapCandidate | null = null;
  let bestAbs = threshold + 1;
  for (const c of candidates) {
    if (kind && c.kind !== kind) continue;
    const a = Math.abs(c.delta);
    if (a <= threshold && a < bestAbs) {
      bestAbs = a;
      best = c;
    }
  }
  return best;
}

function pickAxisSnap(candidates: SnapCandidate[]): SnapCandidate | null {
  return (
    pickBestCandidate(candidates, SNAP_CENTER_ALIGN_THRESHOLD_PX, "center") ??
    pickBestCandidate(candidates, SNAP_ALIGN_THRESHOLD_PX, "edge")
  );
}

function verticalGuide(x: number, yMin: number, yMax: number, extra: Rect): SnapGuideLine {
  return {
    axis: "x",
    flowPos: x,
    flowMin: Math.min(yMin, extra.top),
    flowMax: Math.max(yMax, extra.bottom),
  };
}

function horizontalGuide(y: number, xMin: number, xMax: number, extra: Rect): SnapGuideLine {
  return {
    axis: "y",
    flowPos: y,
    flowMin: Math.min(xMin, extra.left),
    flowMax: Math.max(xMax, extra.right),
  };
}

/**
 * 对本次 position 变更做「相对其他节点」的边/中心对齐吸附；多选拖拽时按整体外接矩形对齐。
 */
export function snapNodePositionChanges(
  changes: NodeChange<Node<FlowNodeData>>[],
  nodes: Node<FlowNodeData>[],
  options?: { showGuides?: boolean },
): SnapNodePositionResult {
  const showGuides = options?.showGuides !== false;
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
  const movingCx = minX + bboxW / 2;
  const movingCy = minY + bboxH / 2;
  const moving: Rect = { left: minX, right: maxX, top: minY, bottom: maxY, cx: movingCx, cy: movingCy };

  const dxCandidates: SnapCandidate[] = [];
  const dyCandidates: SnapCandidate[] = [];

  for (const t of snapTargets) {
    dxCandidates.push(
      {
        delta: t.left - minX,
        guide: verticalGuide(t.left, minY, maxY, t),
        kind: "edge",
      },
      {
        delta: t.right - minX,
        guide: verticalGuide(t.right, minY, maxY, t),
        kind: "edge",
      },
      {
        delta: t.left - maxX,
        guide: verticalGuide(t.left, minY, maxY, t),
        kind: "edge",
      },
      {
        delta: t.right - maxX,
        guide: verticalGuide(t.right, minY, maxY, t),
        kind: "edge",
      },
      {
        delta: t.cx - movingCx,
        guide: verticalGuide(t.cx, minY, maxY, t),
        kind: "center",
      },
    );
    dyCandidates.push(
      {
        delta: t.top - minY,
        guide: horizontalGuide(t.top, minX, maxX, t),
        kind: "edge",
      },
      {
        delta: t.bottom - minY,
        guide: horizontalGuide(t.bottom, minX, maxX, t),
        kind: "edge",
      },
      {
        delta: t.top - maxY,
        guide: horizontalGuide(t.top, minX, maxX, t),
        kind: "edge",
      },
      {
        delta: t.bottom - maxY,
        guide: horizontalGuide(t.bottom, minX, maxX, t),
        kind: "edge",
      },
      {
        delta: t.cy - movingCy,
        guide: horizontalGuide(t.cy, minX, maxX, t),
        kind: "center",
      },
    );
  }

  const dxPick = pickAxisSnap(dxCandidates);
  const dyPick = pickAxisSnap(dyCandidates);
  const dx = dxPick?.delta ?? 0;
  const dy = dyPick?.delta ?? 0;

  if (dx === 0 && dy === 0) {
    return { changes, visual: null };
  }

  const guides: SnapGuideLine[] = [];
  if (showGuides) {
    if (dxPick) guides.push(dxPick.guide);
    if (dyPick) guides.push(dyPick.guide);
    void moving;
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
  return { changes: out, visual: guides.length > 0 ? { guides } : null };
}
