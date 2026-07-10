import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  incomingTextUpstreamState,
  orderedIncomingTextNodeIds,
  textContentFromUpstreamNode,
  type IncomingScriptUpstreamState,
} from "@/lib/incomingScriptBinding";

const TEXT_TYPES = new Set<Node<FlowNodeData>["type"]>(["textNode", "llm"]);

export type ScriptUpstreamTextSource = {
  nodeId: string;
  label: string;
  charCount: number;
  preview: string;
  isEmpty: boolean;
};

/** 已连接的上游文本节点（含正文为空的连线，供底栏标签展示） */
export function listScriptUpstreamTextConnections(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  scriptNodeId: string,
): ScriptUpstreamTextSource[] {
  const state = incomingTextUpstreamState(nodes, edges, scriptNodeId);
  if (state !== "enabled") return [];

  const ids = orderedIncomingTextNodeIds(nodes, edges, scriptNodeId);
  const out: ScriptUpstreamTextSource[] = [];
  for (const id of ids) {
    const n = nodes.find((x) => x.id === id);
    if (!n?.type || !TEXT_TYPES.has(n.type)) continue;
    const content = textContentFromUpstreamNode(n.data);
    const label = n.data.label?.trim() || (n.type === "llm" ? "LLM 节点" : "文本节点");
    out.push({
      nodeId: id,
      label,
      charCount: content.length,
      preview: content.slice(0, 120),
      isEmpty: content.length === 0,
    });
  }
  return out;
}

/** 已连接且正文非空的上游文本（供解析 / 状态文案） */
export function listScriptUpstreamTextSources(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  scriptNodeId: string,
): ScriptUpstreamTextSource[] {
  return listScriptUpstreamTextConnections(nodes, edges, scriptNodeId).filter((s) => !s.isEmpty);
}

export function totalUpstreamTextChars(sources: ScriptUpstreamTextSource[]): number {
  return sources.reduce((sum, s) => sum + s.charCount, 0);
}

export function formatUpstreamTextCharCount(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`;
  return String(n);
}

/** 剧本导入说明（连接上游文本 → DAG 解析时自动作为【待解析剧本文本】） */
export function scriptUpstreamImportStatusMessage(sources: ScriptUpstreamTextSource[]): string {
  if (sources.length === 0) {
    return "未检测到可用的上游剧本文本：请用文本节点写入剧本并连线到本脚本节点";
  }
  const total = totalUpstreamTextChars(sources);
  const names = sources.map((s) => `「${s.label}」`).join("、");
  return `已连接上游剧本 ${names}（约 ${formatUpstreamTextCharCount(total)} 字）。解析时：底栏写解析要求，文本节点正文作为待解析剧本。`;
}

export function scriptUpstreamDisabledEdgeMessage(): string {
  return "上游文本连线已禁用：请启用连线，或在文本节点中编辑剧本后重新解析";
}

export function scriptUpstreamPanelHint(state: IncomingScriptUpstreamState): string {
  if (state === "disabled_only") return scriptUpstreamDisabledEdgeMessage();
  if (state === "none") {
    return "剧本导入：将文本节点（或 LLM 节点）连线到本脚本节点，写入完整剧本后使用底栏「AI 解析镜头」。";
  }
  return "";
}
