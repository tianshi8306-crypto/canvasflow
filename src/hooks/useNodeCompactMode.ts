import { useRef } from "react";
import { useProjectStore } from "@/store/projectStore";

// 当节点在屏幕上的渲染宽度低于此值时进入紧凑态
const COMPACT_ENTER_PX = 180;
// 高于此值时退出紧凑态（滞后区间防止边界抖动）
const COMPACT_EXIT_PX = 220;

/**
 * 根据节点逻辑宽度和当前视口缩放比，决定是否使用缩略图。
 *
 * 策略：
 *  - 选中/展开的节点：永远用原图（expandedChrome 参数控制）
 *  - 未展开但渲染尺寸 ≥ 220px：用原图，用户看得清楚
 *  - 未展开且渲染尺寸 < 180px：用缩略图，用户看不出来差别
 *  - 180~220px 之间：保持上一次状态（滞后，避免缩放时频繁切换）
 *
 * 这样在视口内正常大小显示原图，缩小到看不清时才降级，不影响用户观感。
 */
export function useNodeCompactMode(
  nodeWidth: number,
  expandedChrome: boolean,
): boolean {
  const zoom = useProjectStore((s) => s.viewport.zoom);
  const prevCompact = useRef(false);

  // 展开态永远不降级
  if (expandedChrome) {
    prevCompact.current = false;
    return false;
  }

  const renderedWidth = nodeWidth * zoom;

  if (renderedWidth < COMPACT_ENTER_PX) {
    prevCompact.current = true;
    return true;
  }
  if (renderedWidth > COMPACT_EXIT_PX) {
    prevCompact.current = false;
    return false;
  }

  // 在滞后区间内保持上一次状态
  return prevCompact.current;
}
