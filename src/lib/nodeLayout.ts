import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";

/** 排列节点时，相邻节点外沿之间的统一间距（与画布 CSS 中节点最小宽度等大致协调） */
export const CANVAS_NODE_LAYOUT_GAP = 40;

/** 批量拖拽导入时节点的估算卡片尺寸（折叠态媒体卡，用于宫格错位避免重叠） */
export const IMPORT_BATCH_NODE_ESTIMATE_W = 300;
export const IMPORT_BATCH_NODE_ESTIMATE_H = 240;
/** 单行最多列数；多文件时行优先填充 */
export const IMPORT_BATCH_GRID_MAX_COLS = 3;

/**
 * 为同一落点的批量导入生成错位排布（行优先宫格），满足 R2「批量素材自动错位」验收。
 */
export function computeBatchImportDropPositions(
  count: number,
  base: { x: number; y: number },
): { x: number; y: number }[] {
  if (count <= 0) return [];
  const cols = Math.min(IMPORT_BATCH_GRID_MAX_COLS, Math.max(1, count));
  const stepX = IMPORT_BATCH_NODE_ESTIMATE_W + CANVAS_NODE_LAYOUT_GAP;
  const stepY = IMPORT_BATCH_NODE_ESTIMATE_H + CANVAS_NODE_LAYOUT_GAP;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    out.push({ x: base.x + col * stepX, y: base.y + row * stepY });
  }
  return out;
}

const DEFAULT_W = 280;
const DEFAULT_H = 200;

/**
 * 用于「宫格 / 水平 / 垂直」排列：优先使用 React Flow 测量宽高，避免固定 cell 导致重叠。
 */
export function nodeLayoutDimensions(n: Node<FlowNodeData>): { w: number; h: number } {
  const mw = n.measured?.width;
  const mh = n.measured?.height;
  if (mw != null && mw > 0 && mh != null && mh > 0) {
    return { w: mw, h: mh };
  }
  if (typeof n.width === "number" && n.width > 0 && typeof n.height === "number" && n.height > 0) {
    return { w: n.width, h: n.height };
  }
  const sw = n.style?.width;
  const sh = n.style?.height;
  if (typeof sw === "number" && typeof sh === "number" && sw > 0 && sh > 0) {
    return { w: sw, h: sh };
  }
  if (n.type === "group") {
    const w = typeof n.style?.width === "number" ? n.style.width : 400;
    const h = typeof n.style?.height === "number" ? n.style.height : 280;
    return { w, h };
  }
  return { w: DEFAULT_W, h: DEFAULT_H };
}
