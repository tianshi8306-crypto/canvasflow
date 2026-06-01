export type FlowRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function flowRectsIntersect(a: FlowRect, b: FlowRect): boolean {
  if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) return false;
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** 将画布 pane 的屏幕矩形转换为 flow 坐标系下的视口矩形 */
export function viewportFlowRectFromPane(
  paneClientRect: Pick<DOMRect, "left" | "top" | "right" | "bottom">,
  screenToFlowPosition: (p: { x: number; y: number }) => { x: number; y: number },
): FlowRect {
  const p1 = screenToFlowPosition({ x: paneClientRect.left, y: paneClientRect.top });
  const p2 = screenToFlowPosition({ x: paneClientRect.right, y: paneClientRect.bottom });
  return {
    x: Math.min(p1.x, p2.x),
    y: Math.min(p1.y, p2.y),
    width: Math.abs(p2.x - p1.x),
    height: Math.abs(p2.y - p1.y),
  };
}
