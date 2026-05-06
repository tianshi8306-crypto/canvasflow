/** 将浮动面板左上坐标限制在视口内，避免菜单跑出屏幕 */
export function clampContextMenuPosition(
  clientX: number,
  clientY: number,
  panelWidth: number,
  maxPanelHeight: number,
  padding = 8,
): { x: number; y: number } {
  if (typeof window === "undefined") {
    return { x: clientX, y: clientY };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxX = Math.max(padding, vw - panelWidth - padding);
  const maxY = Math.max(padding, vh - maxPanelHeight - padding);
  return {
    x: Math.min(Math.max(padding, clientX), maxX),
    y: Math.min(Math.max(padding, clientY), maxY),
  };
}
