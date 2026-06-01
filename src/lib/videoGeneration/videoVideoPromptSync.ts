/**
 * 视频 → 视频上游（Seedance 2.0「参考视频」）。
 *
 * 能力边界见 `docs/hermes-knowledge/models/seedance-params.md`：
 * - 参考视频 mp4/mov ≤3，单段 2～15s → `draft.referenceVideoPaths`
 * - prompt 内 `@视频N`；上游 draft.prompt 可辅助镜间延续描述
 */
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { scriptSyncDisabledOnlyStatus } from "@/lib/incomingScriptBinding";
import {
  incomingVideoNodeUpstreamState,
  orderedIncomingVideoNodeIdsToTarget,
  type IncomingVideoUpstreamState,
} from "@/lib/scriptReferenceVideo";
import {
  defaultVideoGenerationDraft,
  defaultVideoNodePersisted,
  type VideoGenerationDraft,
} from "@/lib/videoNodeTypes";
import { VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS } from "@/lib/promptLimits";

export function videoPromptContentFromUpstreamNode(data: FlowNodeData): string {
  return (data.video?.draft?.prompt ?? "").trim();
}

export function getVideoVideoUpstreamState(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  videoNodeId: string,
): IncomingVideoUpstreamState {
  return incomingVideoNodeUpstreamState(nodes, edges, videoNodeId);
}

export type VideoUpstreamVideoSource = {
  nodeId: string;
  label: string;
  charCount: number;
  preview: string;
  hasPath: boolean;
  relPath: string;
};

export function listVideoUpstreamVideoSources(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  videoNodeId: string,
): VideoUpstreamVideoSource[] {
  if (getVideoVideoUpstreamState(nodes, edges, videoNodeId) !== "enabled") return [];

  const ids = orderedIncomingVideoNodeIdsToTarget(nodes, edges, videoNodeId);
  const out: VideoUpstreamVideoSource[] = [];
  for (const id of ids) {
    const n = nodes.find((x) => x.id === id);
    if (n?.type !== "videoNode") continue;
    const content = videoPromptContentFromUpstreamNode(n.data);
    const relPath = (n.data.path ?? "").trim();
    out.push({
      nodeId: id,
      label: n.data.label?.trim() || "视频节点",
      charCount: content.length,
      preview: content.slice(0, 120),
      hasPath: relPath.length > 0,
      relPath,
    });
  }
  return out;
}

export function buildVideoPromptFromUpstreamVideo(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  videoNodeId: string,
): string | null {
  const node = nodes.find((n) => n.id === videoNodeId);
  if (node?.type !== "videoNode") return null;

  const ids = orderedIncomingVideoNodeIdsToTarget(nodes, edges, videoNodeId);
  const parts: string[] = [];
  for (const id of ids) {
    const upstream = nodes.find((n) => n.id === id);
    if (upstream?.type !== "videoNode") continue;
    const content = videoPromptContentFromUpstreamNode(upstream.data);
    if (content) parts.push(content);
  }
  const merged = parts.join("\n\n").trim();
  return merged.length > 0 ? merged : null;
}

export type ApplyVideoPromptFromUpstreamVideoResult =
  | { ok: true; prompt: string }
  | { ok: false; statusMessage: string };

/** 将上游视频节点 draft.prompt 写入本节点 draft.prompt。 */
export function applyVideoPromptFromUpstreamVideo(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  videoNodeId: string,
  maxChars = VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS,
): ApplyVideoPromptFromUpstreamVideoResult {
  const upstream = getVideoVideoUpstreamState(nodes, edges, videoNodeId);
  const merged = buildVideoPromptFromUpstreamVideo(nodes, edges, videoNodeId);
  if (!merged?.trim()) {
    if (upstream === "disabled_only") {
      return { ok: false, statusMessage: scriptSyncDisabledOnlyStatus("同步提示词") };
    }
    if (upstream === "enabled") {
      const sources = listVideoUpstreamVideoSources(nodes, edges, videoNodeId);
      const withPath = sources.filter((s) => s.hasPath).length;
      if (sources.length > 0 && withPath > 0) {
        return {
          ok: false,
          statusMessage: "无法同步：上游视频已出片，但提示词为空。请在上游视频节点中填写提示词。",
        };
      }
      return {
        ok: false,
        statusMessage: "无法同步：上游视频节点已连线，但尚未出片且提示词为空。",
      };
    }
    return {
      ok: false,
      statusMessage: "无法同步：请先将上游视频节点连线到本视频节点。",
    };
  }
  return { ok: true, prompt: merged.slice(0, maxChars) };
}

function mergeVideoDraftPrompt(base: VideoGenerationDraft, prompt: string): VideoGenerationDraft {
  return { ...base, prompt: prompt.slice(0, VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS) };
}

/** 在 nodes 数组上写入视频 prompt（供 onConnect 等批量更新）。 */
export function patchVideoNodesWithUpstreamVideoPrompt(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  videoNodeId: string,
  opts?: { onlyIfPromptEmpty?: boolean },
): Node<FlowNodeData>[] {
  const onlyIfEmpty = opts?.onlyIfPromptEmpty ?? true;
  const node = nodes.find((n) => n.id === videoNodeId);
  if (node?.type !== "videoNode") return nodes;

  const curVideo = node.data.video ?? defaultVideoNodePersisted();
  const curDraft = curVideo.draft ?? defaultVideoGenerationDraft();
  const curPrompt = (curDraft.prompt ?? "").trim();
  if (onlyIfEmpty && curPrompt.length > 0) return nodes;

  const result = applyVideoPromptFromUpstreamVideo(nodes, edges, videoNodeId);
  if (!result.ok) return nodes;

  const nextDraft = mergeVideoDraftPrompt(curDraft, result.prompt);
  return nodes.map((n) =>
    n.id === videoNodeId
      ? {
          ...n,
          data: {
            ...n.data,
            video: { ...defaultVideoNodePersisted(), ...curVideo, draft: nextDraft },
          },
        }
      : n,
  );
}

export function videoUpstreamVideoPanelHint(state: IncomingVideoUpstreamState): string {
  if (state === "disabled_only") {
    return "上游视频连线已禁用：请启用连线后再同步。";
  }
  if (state === "none") {
    return "将上游视频连线到本节点：出片后作为 Seedance 参考视频（≤3 段）；可同步上游 prompt 作镜间延续。";
  }
  return "已连接上游视频（Seedance 参考视频）：出片后写入 referenceVideoPaths；prompt 为空时可同步上游描述。";
}

export function videoUpstreamVideoStatusMessage(sources: VideoUpstreamVideoSource[]): string {
  if (sources.length === 0) return "已连接上游视频节点。";
  const withPath = sources.filter((s) => s.hasPath).length;
  const withPrompt = sources.filter((s) => s.charCount > 0).length;
  const names = sources.map((s) => `「${s.label}」`).join("、");
  if (withPath > 0 && withPrompt > 0) {
    const total = sources.reduce((sum, s) => sum + s.charCount, 0);
    return `上游 ${names}：${withPath} 个已出片作参考视频，提示词约 ${total} 字可同步。`;
  }
  if (withPath > 0) {
    return `上游 ${names} 已出片（${withPath} 个参考视频就绪），提示词为空。`;
  }
  if (withPrompt > 0) {
    const total = sources.reduce((sum, s) => sum + s.charCount, 0);
    return `上游 ${names} 提示词约 ${total} 字可同步；出片后将自动作为参考视频。`;
  }
  return `上游 ${names} 已连接，待出片后将作为参考视频。`;
}
