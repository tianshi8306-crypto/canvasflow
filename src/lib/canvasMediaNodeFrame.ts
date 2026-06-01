/**
 * 图片 / 视频节点预览壳尺寸真源：同一长边 cap + 比例，便于画布打组与对齐。
 * 底栏 Portal 宽 500px（--gen-panel-width），预览长边与之对齐。
 */
export const CANVAS_MEDIA_NODE_MAX_EDGE = 500;
export const CANVAS_MEDIA_NODE_MIN_EDGE = 96;

/** 画布预览框：长边不超过 maxEdge，短边按比例取整 */
export function computeCanvasMediaNodeFrameSize(
  ratio: number,
  maxEdge = CANVAS_MEDIA_NODE_MAX_EDGE,
): { width: number; height: number } {
  if (!Number.isFinite(ratio) || ratio <= 0) ratio = 16 / 9;
  let width: number;
  let height: number;
  if (ratio >= 1) {
    width = maxEdge;
    height = Math.round(maxEdge / ratio);
  } else {
    height = maxEdge;
    width = Math.round(maxEdge * ratio);
  }
  width = Math.max(CANVAS_MEDIA_NODE_MIN_EDGE, width);
  height = Math.max(CANVAS_MEDIA_NODE_MIN_EDGE, height);
  return { width, height };
}
