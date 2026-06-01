import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useNodeChromeMount } from "@/components/nodes/nodeChrome/NodeChromeContext";
import { computeInNodeChromePos, type GenPanelPlacement } from "@/lib/nodeChromeLocalCoords";

export type { GenPanelPlacement };

export const GEN_PANEL_CHROME_WIDTH = 500;
export const GEN_PANEL_CHROME_GAP = 12;
/** 预览顶栏栈底边距预览区顶边（LibTV：元信息行 → 预览） */
export const GEN_PANEL_CHROME_ABOVE_PREVIEW_GAP = 6;
/** 顶栏栈内：功能栏 → 元信息行 */
export const GEN_PANEL_CHROME_STACK_META_GAP = 4;
/** 未迁入 Portal 栈的顶栏（audio/script 等）为外置标签（top:-18）预留的额外抬高 */
export const GEN_PANEL_CHROME_ABOVE_EXTRA = 28;
/** 预览区内顶栏距上缘内边距 */
export const GEN_PANEL_CHROME_INSIDE_TOP_INSET = 10;
/** 层内 z-index：顶栏 / 底栏 Portal（挂载于 NodeChromeProvider 或 #canvas-node-chrome-root） */
export const GEN_PANEL_CHROME_Z = 2;
/** 预览顶栏下拉菜单，略高于顶栏条 */
export const GEN_PANEL_CHROME_MENU_Z = GEN_PANEL_CHROME_Z + 4;

export type GenPanelPos = { x: number; y: number; placement: GenPanelPlacement };

type Options = {
  /** 是否显示并跟踪锚点 */
  active: boolean;
  panelWidth?: number;
  /** 节点内挂载根（NodeChromeProvider）；有则 absolute 相对节点，与预览同层 */
  mountRef?: RefObject<HTMLElement | null>;
  /** below：浮层顶边 = 预览区底边 + gap；above：浮层底边 = 预览区顶边 - gap；inside-top：预览区内顶部居中 */
  placement?: GenPanelPlacement;
  /** above 时与预览顶边的间距（默认 GEN_PANEL_CHROME_GAP） */
  aboveGap?: number;
  /** above 时额外上移（为外置标签留空；视频预览可设为 0） */
  aboveExtra?: number;
};

/**
 * 节点外浮层定位：锚定预览区上/下缘居中，随画布平移/缩放更新。
 * in-node 模式：getBoundingClientRect 差值须乘 invZoom 才是本地 absolute 坐标。
 */
export function useNodeGenerationChrome(
  anchorRef: RefObject<HTMLElement | null>,
  {
    active,
    panelWidth = GEN_PANEL_CHROME_WIDTH,
    mountRef: mountRefOption,
    placement = "below",
    aboveGap,
    aboveExtra,
  }: Options,
) {
  const chromeMount = useNodeChromeMount();
  const mountRef = mountRefOption ?? chromeMount?.mountRef;
  const invZoom = chromeMount?.invZoom ?? 1;

  const [pos, setPos] = useState<GenPanelPos | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const updatePos = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mount = mountRef?.current ?? null;
    const mountRect = mount?.getBoundingClientRect();
    const chromeLocalW = panelRef.current?.offsetWidth ?? panelWidth;

    const gapAbove = aboveGap ?? GEN_PANEL_CHROME_GAP;
    const extraAbove = aboveExtra ?? GEN_PANEL_CHROME_ABOVE_EXTRA;

    if (mount && mountRect) {
      setPos(
        computeInNodeChromePos({
          anchorRect: rect,
          mountRect,
          mountLocalWidth: mount.offsetWidth,
          chromeLocalWidth: chromeLocalW,
          placement,
          invZoom,
          gapAbove,
          aboveExtra: extraAbove,
        }),
      );
      return;
    }

    let x = rect.left + rect.width / 2;
    if (chromeLocalW > 0) {
      x = Math.max(chromeLocalW / 2 + 8, Math.min(x, window.innerWidth - chromeLocalW / 2 - 8));
    }
    const y =
      placement === "below"
        ? rect.bottom + GEN_PANEL_CHROME_GAP
        : placement === "inside-top"
          ? rect.top + GEN_PANEL_CHROME_INSIDE_TOP_INSET
          : rect.top - gapAbove - extraAbove;

    setPos({ x, y, placement });
  }, [
    aboveExtra,
    aboveGap,
    anchorRef,
    invZoom,
    mountRef,
    panelWidth,
    placement,
  ]);

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
    let lastMountRect: DOMRect | null = null;
    let lastChromeW = 0;
    let lastInvZoom = invZoom;
    const tick = () => {
      const el = anchorRef.current;
      if (!el) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const rect = el.getBoundingClientRect();
      const mountRect = mountRef?.current?.getBoundingClientRect() ?? null;
      const chromeW = panelRef.current?.offsetWidth ?? 0;
      const mountMoved =
        Boolean(mountRect) !== Boolean(lastMountRect) ||
        (mountRect &&
          lastMountRect &&
          (Math.abs(mountRect.left - lastMountRect.left) > 0.5 ||
            Math.abs(mountRect.top - lastMountRect.top) > 0.5 ||
            Math.abs(mountRect.width - lastMountRect.width) > 0.5 ||
            Math.abs(mountRect.height - lastMountRect.height) > 0.5));
      if (
        !lastRect ||
        Math.abs(rect.left - lastRect.left) > 0.5 ||
        Math.abs(rect.top - lastRect.top) > 0.5 ||
        Math.abs(rect.width - lastRect.width) > 0.5 ||
        Math.abs(rect.height - lastRect.height) > 0.5 ||
        Math.abs(chromeW - lastChromeW) > 0.5 ||
        mountMoved ||
        Math.abs(invZoom - lastInvZoom) > 0.0001
      ) {
        lastRect = rect;
        lastMountRect = mountRect;
        lastChromeW = chromeW;
        lastInvZoom = invZoom;
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
  }, [active, updatePos, anchorRef, mountRef, invZoom]);

  return { pos, panelRef, updatePos };
}
