import { useCanvasUiStore } from "@/store/canvasUiStore";

/** 结束锚点菜单会话：关闭菜单并清除拖线悬挂预览 */
export function clearAnchorMenuSession(): void {
  const ui = useCanvasUiStore.getState();
  ui.setPendingAnchorConnection(null);
  ui.setAnchorMenuRequest(null);
  ui.bumpAnchorMenuDismiss();
}
