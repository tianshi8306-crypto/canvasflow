import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { isEdgeDisabled } from "@/lib/edgeState";
import { topologicalOrderIds } from "@/lib/incomingScriptBinding";

export type IncomingVideoUpstreamState = "none" | "enabled" | "disabled_only";

export type ScriptReferenceVideoMediaMeta = {
  durationSec?: number;
  width?: number;
  height?: number;
};

export type ScriptReferenceVideoSource = {
  nodeId: string;
  label: string;
  /** 工程内相对路径（与 Rust `incoming_reference_video_paths_ordered` 一致） */
  relPath: string;
  hasPath: boolean;
  /** UI 侧 ffprobe（可选，执行器解析时在后端自动探测） */
  mediaMeta?: ScriptReferenceVideoMediaMeta | null;
};

/** 指向目标节点的上游 videoNode id（拓扑序） */
export function orderedIncomingVideoNodeIdsToTarget(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  targetNodeId: string,
): string[] {
  const order = topologicalOrderIds(nodes, edges);
  if (!order) return [];
  const rank = new Map(order.map((id, i) => [id, i]));
  const seen = new Set<string>();
  const pairs: { r: number; id: string }[] = [];
  for (const e of edges) {
    if (isEdgeDisabled(e)) continue;
    if (e.target !== targetNodeId) continue;
    if (e.targetHandle && e.targetHandle !== "in") continue;
    const n = nodes.find((x) => x.id === e.source);
    if (n?.type !== "videoNode") continue;
    if (seen.has(e.source)) continue;
    seen.add(e.source);
    pairs.push({ r: rank.get(e.source) ?? 0, id: e.source });
  }
  pairs.sort((a, b) => a.r - b.r);
  return pairs.map((p) => p.id);
}

/** 指向脚本节点的上游 videoNode id（拓扑序） */
export function orderedIncomingVideoNodeIds(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  scriptNodeId: string,
): string[] {
  return orderedIncomingVideoNodeIdsToTarget(nodes, edges, scriptNodeId);
}

export function incomingVideoNodeUpstreamState(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  targetNodeId: string,
): IncomingVideoUpstreamState {
  let hasAny = false;
  let hasEnabled = false;
  for (const e of edges) {
    if (e.target !== targetNodeId) continue;
    const source = nodes.find((n) => n.id === e.source);
    if (source?.type !== "videoNode") continue;
    hasAny = true;
    if (!isEdgeDisabled(e)) {
      hasEnabled = true;
      break;
    }
  }
  if (hasEnabled) return "enabled";
  if (hasAny) return "disabled_only";
  return "none";
}

export function incomingVideoUpstreamState(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  scriptNodeId: string,
): IncomingVideoUpstreamState {
  return incomingVideoNodeUpstreamState(nodes, edges, scriptNodeId);
}

export function listScriptReferenceVideoSources(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  scriptNodeId: string,
): ScriptReferenceVideoSource[] {
  if (incomingVideoUpstreamState(nodes, edges, scriptNodeId) !== "enabled") return [];
  const ids = orderedIncomingVideoNodeIds(nodes, edges, scriptNodeId);
  const out: ScriptReferenceVideoSource[] = [];
  for (const id of ids) {
    const n = nodes.find((x) => x.id === id);
    if (n?.type !== "videoNode") continue;
    const relPath = (n.data.path ?? "").trim();
    out.push({
      nodeId: id,
      label: n.data.label?.trim() || "视频节点",
      relPath,
      hasPath: relPath.length > 0,
    });
  }
  return out;
}

export const SCRIPT_REFERENCE_VIDEO_LIMITATION =
  "参考视频将工程内路径与 ffprobe 元信息（时长/分辨率，若可探测）写入解析上下文；当前文本模型无法真正「观看」画面，请结合元信息与解析要求合理推断。";

export function formatScriptReferenceVideoMediaMeta(
  meta: ScriptReferenceVideoMediaMeta | null | undefined,
): string {
  if (!meta) return "";
  const parts: string[] = [];
  if (meta.width != null && meta.height != null) {
    parts.push(`${meta.width}×${meta.height}`);
  }
  if (meta.durationSec != null && Number.isFinite(meta.durationSec)) {
    parts.push(`${meta.durationSec.toFixed(1)}s`);
  }
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

export function scriptReferenceVideoStatusMessage(sources: ScriptReferenceVideoSource[]): string {
  if (sources.length === 0) {
    return "未检测到可用的参考视频：请连接视频节点并确保已导入媒体文件";
  }
  const withPath = sources.filter((s) => s.hasPath).length;
  const names = sources.map((s) => `「${s.label}」`).join("、");
  return `已连接 ${sources.length} 个参考视频 ${names}（${withPath} 个含路径）。解析时路径将注入 LLM；${SCRIPT_REFERENCE_VIDEO_LIMITATION}`;
}

export function scriptReferenceVideoDisabledMessage(): string {
  return "参考视频连线已禁用：请启用连线后重新解析";
}

export function scriptReferenceVideoPanelHint(state: IncomingVideoUpstreamState): string {
  if (state === "disabled_only") return scriptReferenceVideoDisabledMessage();
  if (state === "none") {
    return "参考视频：将视频节点连线到本脚本节点；解析时自动收集 assets 相对路径（非画面理解）。";
  }
  return "";
}

/** 插入解析要求区的参考视频说明块（与执行器 prompt 结构对齐） */
export function buildReferenceVideoPromptBlock(sources: ScriptReferenceVideoSource[]): string {
  if (sources.length === 0) return "";
  const lines = sources.map((s, i) => {
    const pathPart = s.hasPath ? s.relPath : "（视频节点尚未导入文件）";
    const meta = formatScriptReferenceVideoMediaMeta(s.mediaMeta);
    return `${i + 1}. ${pathPart}${meta}`;
  });
  return [
    "【参考视频】",
    SCRIPT_REFERENCE_VIDEO_LIMITATION,
    "已连接参考视频路径：",
    ...lines,
  ].join("\n");
}
