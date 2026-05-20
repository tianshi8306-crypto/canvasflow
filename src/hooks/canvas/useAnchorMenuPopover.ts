import { useCallback, useEffect, useState } from "react";
import { anchorMenuPositionStyle } from "@/lib/anchorMenuPlacement";
import { clearAnchorMenuSession } from "@/lib/anchorMenuSession";
import { useCanvasUiStore } from "@/store/canvasUiStore";

export type AnchorMenuSide = "incoming" | "outgoing";

export type AnchorMenuOpen = {
  side: AnchorMenuSide;
  x: number;
  y: number;
};

/** 锚点菜单：点击或拖线松手（由 FlowCanvas onConnectEnd 写入 request）统一落点 */
export function useAnchorMenuPopover(nodeId: string) {
  const [open, setOpen] = useState<AnchorMenuOpen | null>(null);
  const menuRequest = useCanvasUiStore((s) => s.anchorMenuRequest);

  useEffect(() => {
    if (!menuRequest || menuRequest.nodeId !== nodeId) return;
    setOpen({
      side: menuRequest.direction,
      x: menuRequest.x,
      y: menuRequest.y,
    });
    useCanvasUiStore.getState().setAnchorMenuRequest(null);
  }, [menuRequest, nodeId]);

  const openAtCursor = useCallback((side: AnchorMenuSide, clientX: number, clientY: number) => {
    setOpen({ side, x: clientX, y: clientY });
    useCanvasUiStore.setState({ anchorMenuOpenedAt: Date.now() });
  }, []);

  const close = useCallback(() => {
    setOpen(null);
    clearAnchorMenuSession();
  }, []);

  const menuStyle = open ? anchorMenuPositionStyle(open.x, open.y) : undefined;

  return { open, openAtCursor, close, menuStyle };
}
