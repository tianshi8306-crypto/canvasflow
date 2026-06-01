import type { Node } from "@xyflow/react";
import {
  CANVAS_NODE_LAYOUT_GAP,
  nodeLayoutDimensions,
  resolveNodeLayoutFootprint,
} from "@/lib/nodeLayout";
import type { FlowNodeData } from "@/lib/types";

export type CanvasLayoutMode = "grid" | "horizontal" | "vertical";
export type CanvasGridCols = 2 | 3 | 4;

function sortByVisualOrder(nodes: Node<FlowNodeData>[]): Node<FlowNodeData>[] {
  return [...nodes].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
}

/** 计算一组节点的宫格/横排/纵排坐标（保持当前包围盒左上角为起点） */
export function computeLayoutPositions(
  items: Node<FlowNodeData>[],
  mode: CanvasLayoutMode,
  gap = CANVAS_NODE_LAYOUT_GAP,
  origin?: { x: number; y: number },
  opts?: { gridCols?: CanvasGridCols },
): Map<string, { x: number; y: number }> {
  const next = new Map<string, { x: number; y: number }>();
  if (items.length === 0) return next;

  const sorted = sortByVisualOrder(items);
  const dims = sorted.map((n) => nodeLayoutDimensions(n));
  const baseX = origin?.x ?? Math.min(...sorted.map((n) => n.position.x));
  const baseY = origin?.y ?? Math.min(...sorted.map((n) => n.position.y));

  if (mode === "horizontal") {
    let x = baseX;
    sorted.forEach((n, i) => {
      const { w } = dims[i]!;
      next.set(n.id, { x, y: baseY });
      x += w + gap;
    });
    return next;
  }

  if (mode === "vertical") {
    let y = baseY;
    sorted.forEach((n, i) => {
      const { h } = dims[i]!;
      next.set(n.id, { x: baseX, y });
      y += h + gap;
    });
    return next;
  }

  const autoCols = Math.ceil(Math.sqrt(sorted.length));
  const cols = opts?.gridCols ? Math.min(opts.gridCols, sorted.length) : autoCols;
  const rows = Math.ceil(sorted.length / cols);
  const colWidths = Array.from({ length: cols }, () => 0);
  const rowHeights = Array.from({ length: rows }, () => 0);

  sorted.forEach((n, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // 优先用布局占地估算，避免 measured 缺失时默认值偏小导致重叠
    const { w, h } = resolveNodeLayoutFootprint(n);
    colWidths[col] = Math.max(colWidths[col] ?? 0, w);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, h);
  });

  const colOffsets = Array.from({ length: cols }, () => 0);
  const rowOffsets = Array.from({ length: rows }, () => 0);
  for (let c = 1; c < cols; c++) {
    colOffsets[c] = colOffsets[c - 1]! + colWidths[c - 1]! + gap;
  }
  for (let r = 1; r < rows; r++) {
    rowOffsets[r] = rowOffsets[r - 1]! + rowHeights[r - 1]! + gap;
  }

  sorted.forEach((n, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    next.set(n.id, { x: baseX + colOffsets[col]!, y: baseY + rowOffsets[row]! });
  });
  return next;
}

/**
 * 整理画布：重排所有顶层节点（无 parentId），组内子节点随组移动。
 * @returns 被移动的顶层节点数量；0 表示无可整理节点
 */
export function applyCanvasTidyLayout(
  nodes: Node<FlowNodeData>[],
  gap = CANVAS_NODE_LAYOUT_GAP,
  mode: CanvasLayoutMode = "grid",
): { nodes: Node<FlowNodeData>[]; movedCount: number } {
  const topLevel = nodes.filter((n) => !n.parentId);
  if (topLevel.length === 0) {
    return { nodes, movedCount: 0 };
  }

  const positions = computeLayoutPositions(topLevel, mode, gap);
  const nextNodes = nodes.map((n) => {
    const p = positions.get(n.id);
    return p ? { ...n, position: p } : n;
  });

  return { nodes: nextNodes, movedCount: topLevel.length };
}
