/** 脚本节点 Chrome 壳尺寸（画布内随 zoom 缩放，对标文本预览壳） */

import {
  TEXT_NODE_CHROME_HEIGHT_EMPTY,
  TEXT_NODE_CHROME_WIDTH,
} from "@/lib/textNodeChrome";

export const SCRIPT_NODE_SHELL_WIDTH = TEXT_NODE_CHROME_WIDTH;
export const SCRIPT_NODE_MIN_HEIGHT_EMPTY = TEXT_NODE_CHROME_HEIGHT_EMPTY;
/** 每条镜头行的估算高度（px，用于迷你预览） */
const SCRIPT_MINI_ROW_HEIGHT = 28;
/** 壳内一次可见的最大行数（超出则滚动浏览） */
export const SCRIPT_MINI_PREVIEW_MAX_ROWS = 6;

/** 根据镜头数量计算壳高度：空为最小高度，有镜头时最高展示 6 行可见区域 */
export function computeScriptNodeFrameSize(
  hasBeats: boolean,
  beatCount: number,
): { width: number; height: number } {
  if (!hasBeats || beatCount <= 0) {
    return { width: SCRIPT_NODE_SHELL_WIDTH, height: SCRIPT_NODE_MIN_HEIGHT_EMPTY };
  }
  // 可见行数上限：再多则滚动浏览
  const visibleRows = Math.min(beatCount, SCRIPT_MINI_PREVIEW_MAX_ROWS);
  const previewHeight = visibleRows * SCRIPT_MINI_ROW_HEIGHT;
  // 完整展开区域的壳高度（padding + 表头 + 脚注）
  const shellHeight = Math.max(SCRIPT_NODE_MIN_HEIGHT_EMPTY, previewHeight + 48);
  return { width: SCRIPT_NODE_SHELL_WIDTH, height: shellHeight };
}
