import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export const GEN_PANEL_CHROME_WIDTH = 500;
export const GEN_PANEL_CHROME_GAP = 12;
/** 顶栏在预览区上缘外再抬高，为节点外标签（top:-18）留出空隙 */
export const GEN_PANEL_CHROME_ABOVE_EXTRA = 28;
/** 预览区内顶栏距上缘内边距 */
export const GEN_PANEL_CHROME_INSIDE_TOP_INSET = 10;
export const GEN_PANEL_CHROME_Z = 40;

export type GenPanelPlacement = "below" | "above" | "inside-top";
export type GenPanelPos = { x: number; y: number; placement: GenPanelPlacement };

type Options = {
  /** 是否显示并跟踪锚点 */
  active: boolean;
  panelWidth?: number;
  /** below：浮层顶边 = 预览区底边 + gap；above：浮层底边 = 预览区顶边 - gap；inside-top：预览区内顶部居中 */
  placement?: GenPanelPlacement;
  /** above 时与预览顶边的间距（默认 GEN_PANEL_CHROME_GAP） */
  aboveGap?: number;
  /** above 时额外上移（为外置标签留空；视频预览可设为 0） */
  aboveExtra?: number;
};

/**
 * 节点外浮层定位：锚定预览区上/下缘居中，随画布平移/缩放更新。
 */
export function useNodeGenerationChrome(
  anchorRef: RefObject<HTMLElement | null>,
  {
    active,
    panelWidth = GEN_PANEL_CHROME_WIDTH,
    placement = "below",
    aboveGap,
    aboveExtra,
  }: Options,
) {
  const [pos, setPos] = useState<GenPanelPos | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const updatePos = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let x = rect.left + rect.width / 2;
    const chromeW = panelRef.current?.offsetWidth ?? panelWidth;
    if (chromeW > 0) {
      x = Math.max(chromeW / 2 + 8, Math.min(x, window.innerWidth - chromeW / 2 - 8));
    }
    const gapAbove = aboveGap ?? GEN_PANEL_CHROME_GAP;
    const extraAbove = aboveExtra ?? GEN_PANEL_CHROME_ABOVE_EXTRA;
    const y =
      placement === "below"
        ? rect.bottom + GEN_PANEL_CHROME_GAP
        : placement === "inside-top"
          ? rect.top + GEN_PANEL_CHROME_INSIDE_TOP_INSET
          : rect.top - gapAbove - extraAbove;
    setPos({ x, y, placement });
  }, [aboveExtra, aboveGap, anchorRef, panelWidth, placement]);

  useEffect(() => {
    if (!active) {
      setPos(null);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    updatePos();
    let lastRect: DOMRect | null = null;
    let lastChromeW = 0;
    const tick = () => {
      const el = anchorRef.current;
      if (!el) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const rect = el.getBoundingClientRect();
      const chromeW = panelRef.current?.offsetWidth ?? 0;
      if (
        !lastRect ||
        Math.abs(rect.left - lastRect.left) > 0.5 ||
        Math.abs(rect.top - lastRect.top) > 0.5 ||
        Math.abs(rect.width - lastRect.width) > 0.5 ||
        Math.abs(rect.height - lastRect.height) > 0.5 ||
        Math.abs(chromeW - lastChromeW) > 0.5
      ) {
        lastRect = rect;
        lastChromeW = chromeW;
        updatePos();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active, updatePos, anchorRef]);

  return { pos, panelRef, updatePos };
}
