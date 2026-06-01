/**
 * 音频 → 视频上游（Seedance 2.0「全能参考」）。
 *
 * 能力边界见 `docs/hermes-knowledge/models/seedance-params.md`：
 * - 参考音频 mp3/wav ≤3，总长 ≤15s → `draft.referenceAudioPaths`
 * - prompt 内 `@声音N`（参考条顺序）由 `videoPromptAtTokens` 解析
 * - **台词走音频轨**：勿将 TTS 原文灌进 video draft.prompt（见 `seedance.md`）
 */
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  audioContentFromUpstreamNode,
  incomingAudioUpstreamState,
  orderedIncomingAudioNodeIds,
  scriptSyncDisabledOnlyStatus,
  type IncomingScriptUpstreamState,
} from "@/lib/incomingScriptBinding";

export function getVideoAudioUpstreamState(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  videoNodeId: string,
): IncomingScriptUpstreamState {
  return incomingAudioUpstreamState(nodes, edges, videoNodeId);
}

export type VideoUpstreamAudioSource = {
  nodeId: string;
  label: string;
  hasPath: boolean;
  relPath: string;
  /** TTS 文案字数（仅展示；不写入 video prompt） */
  ttsCharCount: number;
};

export function listVideoUpstreamAudioSources(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  videoNodeId: string,
): VideoUpstreamAudioSource[] {
  if (getVideoAudioUpstreamState(nodes, edges, videoNodeId) !== "enabled") return [];

  const ids = orderedIncomingAudioNodeIds(nodes, edges, videoNodeId);
  const out: VideoUpstreamAudioSource[] = [];
  for (const id of ids) {
    const n = nodes.find((x) => x.id === id);
    if (n?.type !== "audioNode") continue;
    const relPath = (n.data.path ?? "").trim();
    out.push({
      nodeId: id,
      label: n.data.label?.trim() || "音频节点",
      hasPath: relPath.length > 0,
      relPath,
      ttsCharCount: audioContentFromUpstreamNode(n.data).length,
    });
  }
  return out;
}

export function videoUpstreamAudioPanelHint(state: IncomingScriptUpstreamState): string {
  if (state === "disabled_only") {
    return "上游音频连线已禁用：请启用连线后再使用 Seedance 全能参考。";
  }
  if (state === "none") {
    return "将音频节点连线到本节点：出片后作为 Seedance 参考音频（≤3 段）；台词走音频轨，prompt 写画面与运镜。";
  }
  return "已连接上游音频（Seedance 全能参考）：出片后写入 referenceAudioPaths；可在 prompt 用 @声音N 引用。";
}

export function videoUpstreamAudioStatusMessage(sources: VideoUpstreamAudioSource[]): string {
  if (sources.length === 0) return "已连接上游音频节点。";
  const withPath = sources.filter((s) => s.hasPath).length;
  const names = sources.map((s) => `「${s.label}」`).join("、");
  if (withPath > 0) {
    return `上游 ${names}：${withPath} 段参考音频已就绪（Seedance ≤3 段 / 总长 ≤15s）。prompt 写画面，台词由 @声音N 引用。`;
  }
  return `上游 ${names} 已连接，待 TTS 出片后将作为 Seedance 参考音频。`;
}

export function videoUpstreamAudioDisabledActionMessage(): string {
  return scriptSyncDisabledOnlyStatus("使用参考音频");
}

/** 参考条中第一个上游音频对应的 @声音N（无则 null）。 */
export function firstSeedanceAudioAtToken(
  audioSources: VideoUpstreamAudioSource[],
  audioAtTokenByNodeId: Map<string, string>,
): string | null {
  for (const s of audioSources) {
    if (!s.hasPath) continue;
    const token = audioAtTokenByNodeId.get(s.nodeId);
    if (token) return token;
  }
  return null;
}
