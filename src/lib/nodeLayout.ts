import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  computeImageNodeFrameSize,
  resolveImageNodeFrameRatio,
} from "@/lib/imageGeneration/imageAspectSize";
import { readImageOutputParams } from "@/lib/imageGeneration/imageOutputParams";
import {
  computeVideoNodeFrameSize,
  resolveVideoNodeFrameRatio,
} from "@/lib/videoGeneration/videoAspectSize";
import type { TextToVideoAspectId } from "@/lib/videoNodeTypes";

/** 排列节点时，相邻节点外沿之间的统一间距（与画布 CSS 中节点最小宽度等大致协调） */
export const CANVAS_NODE_LAYOUT_GAP = 40;

/** Portal 生成面板在预览区下方的间距（对齐 GEN_PANEL_CHROME_GAP） */
export const GEN_PANEL_LAYOUT_GAP = 12;
/** 展开态生成面板估算高度（LibTV 底栏 + 参考条 + prompt） */
export const GEN_PANEL_LAYOUT_ESTIMATE_H = 224;

/** 批量拖拽导入时节点的估算卡片尺寸（折叠态媒体卡，用于宫格错位避免重叠） */
export const IMPORT_BATCH_NODE_ESTIMATE_W = 300;
export const IMPORT_BATCH_NODE_ESTIMATE_H = 240;
/** 单行最多列数；多文件时行优先填充 */
export const IMPORT_BATCH_GRID_MAX_COLS = 3;

/** 多图生成落盘：与 `IMAGE_COUNT_OPTIONS` 上限一致，行优先宫格 */
export const IMAGE_OUTPUT_GRID_MAX_COLS = 4;
export const IMAGE_OUTPUT_GRID_CELL_W = 520;
export const IMAGE_OUTPUT_GRID_CELL_H = 320;

/**
 * 以锚点节点为左上角，为 N 张输出图计算宫格坐标（含锚点自身占第 1 格）。
 */
function imageOutputGridColumnCount(count: number): number {
  if (count <= 1) return 1;
  if (count === 4) return 2;
  return 2;
}

export function computeImageOutputGridPositions(
  count: number,
  anchor: { x: number; y: number },
): { x: number; y: number }[] {
  if (count <= 0) return [];
  const cols = imageOutputGridColumnCount(count);
  const stepX = IMAGE_OUTPUT_GRID_CELL_W + CANVAS_NODE_LAYOUT_GAP;
  const stepY = IMAGE_OUTPUT_GRID_CELL_H + CANVAS_NODE_LAYOUT_GAP;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    out.push({ x: anchor.x + col * stepX, y: anchor.y + row * stepY });
  }
  return out;
}

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

export type NodeLayoutFootprintOpts = {
  /** 图片/视频选中展开时，计入预览区下方 Portal 生成面板占用 */
  includeGenPanel?: boolean;
};

/**
 * 布局用节点占地：优先 RF 实测，否则按类型推算预览框尺寸（非 280×200 兜底）。
 * fork 副本、对齐、碰撞检测等应使用此函数而非裸 nodeLayoutDimensions。
 */
export function resolveNodeLayoutFootprint(
  n: Node<FlowNodeData>,
  opts?: NodeLayoutFootprintOpts,
): { w: number; h: number } {
  let w: number;
  let h: number;

  const mw = n.measured?.width;
  const mh = n.measured?.height;
  if (mw != null && mw > 0 && mh != null && mh > 0) {
    w = mw;
    h = mh;
  } else if (n.type === "imageNode") {
    const outputParams = readImageOutputParams(n.data?.params);
    const ratio = resolveImageNodeFrameRatio({
      aspectId: outputParams.aspect,
      imageWidth: n.data?.imageWidth,
      imageHeight: n.data?.imageHeight,
    });
    const frame = computeImageNodeFrameSize(ratio);
    w = frame.width;
    h = frame.height;
  } else if (n.type === "videoNode") {
    const aspectId =
      (n.data?.video?.draft?.output?.aspectRatio as TextToVideoAspectId | undefined) ?? "16:9";
    const ratio = resolveVideoNodeFrameRatio({ aspectId });
    const frame = computeVideoNodeFrameSize(ratio);
    w = frame.width;
    h = frame.height;
  } else {
    const dim = nodeLayoutDimensions(n);
    w = dim.w;
    h = dim.h;
  }

  if (opts?.includeGenPanel && (n.type === "imageNode" || n.type === "videoNode")) {
    h += GEN_PANEL_LAYOUT_GAP + GEN_PANEL_LAYOUT_ESTIMATE_H;
  }

  return { w, h };
}
