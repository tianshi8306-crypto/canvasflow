export type GenPanelPlacement = "below" | "above" | "inside-top";

const DEFAULT_GAP_BELOW = 12;
const DEFAULT_GAP_ABOVE = 12;
const DEFAULT_ABOVE_EXTRA = 28;
const DEFAULT_INSIDE_TOP_INSET = 10;

type Rect = Pick<DOMRect, "left" | "top" | "bottom" | "width">;

/** 视口像素差 → 缩放节点内的本地坐标（invZoom = 1 / canvasZoom） */
export function viewportDeltaToLocal(delta: number, invZoom: number): number {
  return delta * invZoom;
}

export type InNodeChromePosInput = {
  anchorRect: Rect;
  mountRect: Pick<DOMRect, "left" | "top">;
  mountLocalWidth: number;
  chromeLocalWidth: number;
  placement: GenPanelPlacement;
  invZoom: number;
  gapBelow?: number;
  gapAbove?: number;
  aboveExtra?: number;
  insideTopInset?: number;
};

/** in-node absolute 定位：锚点相对 mount 的本地坐标 */
export function computeInNodeChromePos({
  anchorRect,
  mountRect,
  mountLocalWidth,
  chromeLocalWidth,
  placement,
  invZoom,
  gapBelow = DEFAULT_GAP_BELOW,
  gapAbove = DEFAULT_GAP_ABOVE,
  aboveExtra = DEFAULT_ABOVE_EXTRA,
  insideTopInset = DEFAULT_INSIDE_TOP_INSET,
}: InNodeChromePosInput): { x: number; y: number; placement: GenPanelPlacement } {
  let x = viewportDeltaToLocal(
    anchorRect.left - mountRect.left + anchorRect.width / 2,
    invZoom,
  );

  if (chromeLocalWidth > 0 && mountLocalWidth > 0) {
    const minX = chromeLocalWidth / 2 + 8;
    const maxX = mountLocalWidth - chromeLocalWidth / 2 - 8;
    x = Math.max(minX, Math.min(x, maxX > minX ? maxX : minX));
  }

  let y: number;
  if (placement === "below") {
    y = viewportDeltaToLocal(anchorRect.bottom - mountRect.top, invZoom) + gapBelow;
  } else if (placement === "inside-top") {
    y = viewportDeltaToLocal(anchorRect.top - mountRect.top, invZoom) + insideTopInset;
  } else {
    y =
      viewportDeltaToLocal(anchorRect.top - mountRect.top, invZoom) - gapAbove - aboveExtra;
  }

  return { x, y, placement };
}
