/**
 * 画布配色常量 — 真源见 docs/design/canvas-color-system.md
 * TS 侧连线/预览无法使用 CSS 变量时请引用本文件，勿散落硬编码。
 */

/** 默认连线 · 策略 A（柔灰，专注） */
export const CANVAS_EDGE_STROKE_DEFAULT = "#9a9895";

/** 选中 / 激活连线 */
export const CANVAS_EDGE_STROKE_ACTIVE = "#7dd3fc";

/** 运行中 */
export const CANVAS_EDGE_STROKE_RUNNING = "#7dd3fc";

/** 禁用 */
export const CANVAS_EDGE_STROKE_DISABLED = "#6e6c69";

export const CANVAS_EDGE_WIDTH_DEFAULT = 2;
export const CANVAS_EDGE_WIDTH_ACTIVE = 2.5;

export const CANVAS_EDGE_STYLE_DEFAULT = {
  strokeWidth: CANVAS_EDGE_WIDTH_DEFAULT,
  stroke: CANVAS_EDGE_STROKE_DEFAULT,
} as const;

/** P3 · 脚本表斑马行 / 选中行（§9） */
export const CANVAS_CHARCOAL_ZEBRA = "#141414";
export const CANVAS_TABLE_ROW_SELECTED = "rgba(56, 189, 248, 0.12)";

/** L0 点阵（§7 canvas-color-system） */
export const CANVAS_BACKGROUND_DOT = "rgba(232, 230, 227, 0.06)";

/** 拖入 / 导入素材时的画布虚线框填充（§15-D，对齐 --cf-accent-focus） */
export const CANVAS_DROP_OVERLAY_FILL = "rgba(56, 189, 248, 0.08)";

/** 导入进行中（--cf-cyan） */
export const CANVAS_DROP_OVERLAY_FILL_IMPORT = "rgba(56, 189, 248, 0.12)";
