import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { CANVAS_NODE_LAYOUT_GAP, nodeLayoutDimensions } from "@/lib/nodeLayout";
import {
  runIgnoringReactFlowSelectionEcho,
  runWithReactFlowGraphSyncLock,
} from "@/lib/reactFlowControlled";
import { useProjectStore } from "@/store/projectStore";

export type PaneRectLike = Pick<DOMRect, "left" | "top" | "width" | "height">;

export type SpawnNodeContext = {
  screenToFlowPosition: (p: { x: number; y: number }) => { x: number; y: number };
  getExistingNodes: () => Node<FlowNodeData>[];
  addNode: (node: Node<FlowNodeData>) => void;
  /** 相对 pane 可见区域高度的落点（0=顶，0.5=中，1=底） */
  yRatio?: number;
  paneRect?: PaneRectLike;
  /** 添加后选中（默认 true） */
  selectAfterAdd?: boolean;
};

function layoutRectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  gap: number,
): boolean {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

/** 当前可见 pane 中心对应的 flow 坐标（必须用 screenToFlowPosition） */
export function paneCenterFlowPosition(
  screenToFlowPosition: SpawnNodeContext["screenToFlowPosition"],
  paneRect: PaneRectLike,
  yRatio = 0.5,
): { x: number; y: number } {
  const y = paneRect.top + paneRect.height * Math.min(1, Math.max(0, yRatio));
  return screenToFlowPosition({
    x: paneRect.left + paneRect.width / 2,
    y,
  });
}

export function flowTopLeftFromCenter(
  center: { x: number; y: number },
  size: { w: number; h: number },
): { x: number; y: number } {
  return { x: center.x - size.w / 2, y: center.y - size.h / 2 };
}

/** 在视口中心附近找不重叠的左上角坐标（行优先错位） */
export function resolveNonOverlappingTopLeft(
  preferredTopLeft: { x: number; y: number },
  size: { w: number; h: number },
  existingNodes: Node<FlowNodeData>[],
  maxAttempts = 32,
): { x: number; y: number } {
  const gap = CANVAS_NODE_LAYOUT_GAP;
  const stepX = size.w + gap;
  const stepY = size.h + gap;
  const cols = 4;

  const collides = (pos: { x: number; y: number }) => {
    const candidate = { x: pos.x, y: pos.y, width: size.w, height: size.h };
    return existingNodes.some((n) => {
      const dim = nodeLayoutDimensions(n);
      return layoutRectsOverlap(candidate, { x: n.position.x, y: n.position.y, width: dim.w, height: dim.h }, gap);
    });
  };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const col = attempt % cols;
    const row = Math.floor(attempt / cols);
    const pos = {
      x: preferredTopLeft.x + col * stepX,
      y: preferredTopLeft.y + row * stepY,
    };
    if (!collides(pos)) return pos;
  }
  return {
    x: preferredTopLeft.x + maxAttempts * 8,
    y: preferredTopLeft.y + maxAttempts * 8,
  };
}

function readPaneRect(): PaneRectLike | null {
  const pane = document.querySelector(".canvasWrap .react-flow__pane");
  if (!pane) return null;
  const r = pane.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  return r;
}

function nextNodeZIndex(existingNodes: Node<FlowNodeData>[]): number {
  let max = 0;
  for (const n of existingNodes) {
    const z = typeof n.zIndex === "number" ? n.zIndex : 0;
    if (z > max) max = z;
  }
  return max + 1;
}

/**
 * 在可见画布区域内添加节点：pane 中心落点 + 左上角对齐 + 与已有节点错位 + 置顶显示。
 */
export function spawnNodeInView(factory: () => Node<FlowNodeData>, ctx: SpawnNodeContext): Node<FlowNodeData> {
  const node = factory();
  const existing = ctx.getExistingNodes();
  const pane = ctx.paneRect ?? readPaneRect();

  if (pane) {
    const center = paneCenterFlowPosition(ctx.screenToFlowPosition, pane, ctx.yRatio ?? 0.5);
    const dim = nodeLayoutDimensions(node);
    node.position = resolveNonOverlappingTopLeft(flowTopLeftFromCenter(center, dim), dim, existing);
  }

  node.zIndex = nextNodeZIndex(existing);
  const select = ctx.selectAfterAdd !== false;
  runWithReactFlowGraphSyncLock(() => {
    ctx.addNode(node);
    if (select) {
      runIgnoringReactFlowSelectionEcho(() => {
        useProjectStore.getState().setSelectedNodeIds([node.id]);
      });
    }
  });

  return node;
}

/** @deprecated 使用 spawnNodeInView + screenToFlowPosition */
export function spawnNodeAtViewportCenter(
  factory: () => Node<FlowNodeData>,
  screenToFlowPosition: SpawnNodeContext["screenToFlowPosition"],
  addNode: SpawnNodeContext["addNode"],
  yRatio?: number,
) {
  spawnNodeInView(factory, {
    screenToFlowPosition,
    addNode,
    getExistingNodes: () => useProjectStore.getState().nodes,
    yRatio,
  });
}
