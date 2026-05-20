import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  buildPromptFromScriptBeatBinding,
  incomingScriptUpstreamState,
  scriptSyncDisabledOnlyStatus,
  type IncomingScriptUpstreamState,
} from "@/lib/incomingScriptBinding";

export function getImageScriptBoundPrompt(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  imageNodeId: string,
): string | null {
  return buildPromptFromScriptBeatBinding(nodes, edges, imageNodeId);
}

export function getImageScriptUpstreamState(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  imageNodeId: string,
): IncomingScriptUpstreamState {
  return incomingScriptUpstreamState(nodes, edges, imageNodeId);
}

export type ApplyImagePromptFromScriptResult =
  | { ok: true; prompt: string }
  | { ok: false; statusMessage: string };

/** 将脚本镜头文案写入图片节点 prompt（截断由调用方传入 maxChars）。 */
export function applyImagePromptFromScript(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  imageNodeId: string,
  maxChars: number,
): ApplyImagePromptFromScriptResult {
  const upstream = getImageScriptUpstreamState(nodes, edges, imageNodeId);
  const bound = getImageScriptBoundPrompt(nodes, edges, imageNodeId);
  if (!bound?.trim()) {
    if (upstream === "disabled_only") {
      return { ok: false, statusMessage: scriptSyncDisabledOnlyStatus("从脚本同步") };
    }
    return {
      ok: false,
      statusMessage: "无法从脚本同步：请绑定 scriptBeatId 并连接上游脚本，且镜头内需有画面描述。",
    };
  }
  return { ok: true, prompt: bound.slice(0, maxChars) };
}
