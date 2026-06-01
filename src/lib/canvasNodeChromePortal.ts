/** 画布内节点 Chrome（顶栏 / 底栏）统一 Portal 挂载点 id */
export const CANVAS_NODE_CHROME_ROOT_ID = "canvas-node-chrome-root";

/** 与 `.canvasNodeChromeRoot` 同层；子 Portal 用 GEN_PANEL_CHROME_Z 做层内排序 */
export function getNodeChromePortalContainer(): HTMLElement {
  if (typeof document === "undefined") {
    return null as unknown as HTMLElement;
  }
  return document.getElementById(CANVAS_NODE_CHROME_ROOT_ID) ?? document.body;
}
