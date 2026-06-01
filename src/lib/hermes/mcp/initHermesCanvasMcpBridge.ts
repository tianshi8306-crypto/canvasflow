import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invokeHermesCanvasMcpTool } from "@/lib/hermes/agent/hermesCanvasMcp";

type CanvasMcpToolCallPayload = {
  requestId: string;
  name: string;
  arguments?: Record<string, unknown>;
  sourceMessage?: string;
};

/**
 * 监听 Rust 桥接层转发的 MCP tools/call，执行 runHermesTool 并回传结果。
 */
export function initHermesCanvasMcpBridge(): () => void {
  if (!isTauri()) return () => {};

  let unlisten: UnlistenFn | null = null;
  let cancelled = false;

  void listen<CanvasMcpToolCallPayload>("canvas-mcp-tool-call", async (event) => {
    const { requestId, name, arguments: args, sourceMessage } = event.payload;
    try {
      const result = await invokeHermesCanvasMcpTool(name, args, {
        sourceMessage: sourceMessage?.trim() || `mcp:${name}`,
      });
      await invoke("canvas_mcp_tool_result", {
        requestId,
        ok: result.ok,
        message: result.message,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await invoke("canvas_mcp_tool_result", {
        requestId,
        ok: false,
        message,
      });
    }
  }).then((fn) => {
    if (cancelled) fn();
    else unlisten = fn;
  });

  return () => {
    cancelled = true;
    unlisten?.();
  };
}
