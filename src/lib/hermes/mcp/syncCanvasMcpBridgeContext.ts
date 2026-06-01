import { invoke, isTauri } from "@tauri-apps/api/core";

/** 同步 MCP 桥接层：工程路径 + 前端是否就绪 */
export function syncCanvasMcpBridgeContext(projectPath: string | null): void {
  if (!isTauri()) return;
  void invoke("canvas_mcp_bridge_set_context", {
    projectPath: projectPath?.trim() || null,
    frontendReady: true,
  });
}

export function markCanvasMcpBridgeFrontendReady(ready: boolean): void {
  if (!isTauri()) return;
  void invoke("canvas_mcp_bridge_set_context", {
    projectPath: null,
    frontendReady: ready,
  });
}
