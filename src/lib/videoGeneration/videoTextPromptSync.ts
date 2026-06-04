/**
 * 文本 → 视频上游（Seedance 2.0「文生视频」）。
 *
 * 能力边界见 `docs/hermes-knowledge/models/seedance-params.md`：自然语言 prompt。
 */
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import {
  buildMergedPromptFromUpstreamText,
  incomingTextUpstreamState,
  orderedIncomingTextNodeIds,
  scriptSyncDisabledOnlyStatus,
  textContentFromUpstreamNode,
  type IncomingScriptUpstreamState,
} from "@/lib/incomingScriptBinding";
import {
  defaultVideoGenerationDraft,
  defaultVideoNodePersisted,
  type VideoGenerationDraft,
} from "@/lib/videoNodeTypes";
import { VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS } from "@/lib/promptLimits";

const TEXT_TYPES = new Set<Node<FlowNodeData>["type"]>(["textNode", "llm"]);

export type VideoUpstreamTextSource = {
  nodeId: string;
  label: string;
  charCount: number;
  preview: string;
};

export function getVideoTextUpstreamState(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  videoNodeId: string,
): IncomingScriptUpstreamState {
  return incomingTextUpstreamState(nodes, edges, videoNodeId);
}

export function listVideoUpstreamTextSources(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  videoNodeId: string,
): VideoUpstreamTextSource[] {
  if (getVideoTextUpstreamState(nodes, edges, videoNodeId) !== "enabled") return [];

  const ids = orderedIncomingTextNodeIds(nodes, edges, videoNodeId);
  const out: VideoUpstreamTextSource[] = [];
  for (const id of ids) {
    const n = nodes.find((x) => x.id === id);
    if (!n?.type || !TEXT_TYPES.has(n.type)) continue;
    const content = textContentFromUpstreamNode(n.data);
    if (!content) continue;
    out.push({
      nodeId: id,
      label: n.data.label?.trim() || (n.type === "llm" ? "LLM 节点" : "文本节点"),
      charCount: content.length,
      preview: content.slice(0, 120),
    });
  }
  return out;
}

export function buildVideoPromptFromUpstreamText(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  videoNodeId: string,
): string | null {
  const node = nodes.find((n) => n.id === videoNodeId);
  if (node?.type !== "videoNode") return null;
  return buildMergedPromptFromUpstreamText(nodes, edges, videoNodeId);
}

export type ApplyVideoPromptFromUpstreamTextResult =
  | { ok: true; prompt: string }
  | { ok: false; statusMessage: string };

/** 将上游文本节点正文写入视频 draft.prompt（默认整段替换）。 */
export function applyVideoPromptFromUpstreamText(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  videoNodeId: string,
  maxChars = VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS,
): ApplyVideoPromptFromUpstreamTextResult {
  const upstream = getVideoTextUpstreamState(nodes, edges, videoNodeId);
  const merged = buildVideoPromptFromUpstreamText(nodes, edges, videoNodeId);
  if (!merged?.trim()) {
    if (upstream === "disabled_only") {
      return { ok: false, statusMessage: scriptSyncDisabledOnlyStatus("注入文本") };
    }
    if (upstream === "enabled") {
      return {
        ok: false,
        statusMessage: "无法注入：上游文本节点已连线，但正文为空。请先在文本节点中写入内容。",
      };
    }
    return {
      ok: false,
      statusMessage: "无法注入：请先将文本节点（或 LLM 节点）连线到本视频节点。",
    };
  }
  return { ok: true, prompt: merged.slice(0, maxChars) };
}

function mergeVideoDraftPrompt(
  base: VideoGenerationDraft,
  prompt: string,
): VideoGenerationDraft {
  return { ...base, prompt: prompt.slice(0, VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS) };
}

/** 在 nodes 数组上写入视频 prompt（供 onConnect 等批量更新）。 */
export function patchVideoNodesWithUpstreamTextPrompt(
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

  const result = applyVideoPromptFromUpstreamText(nodes, edges, videoNodeId);
  if (!result.ok) return nodes;

  const nextDraft = mergeVideoDraftPrompt(curDraft, result.prompt);
  const patch: Partial<FlowNodeData> = {
    video: {
      ...defaultVideoNodePersisted(),
      ...curVideo,
      draft: nextDraft,
    },
  };

  return nodes.map((n) => (n.id === videoNodeId ? { ...n, data: { ...n.data, ...patch } } : n));
}

export function videoUpstreamTextPanelHint(state: IncomingScriptUpstreamState): string {
  if (state === "disabled_only") {
    return "上游文本连线已禁用：请启用连线后再注入。";
  }
  if (state === "none") {
    return "将文本节点连线到本节点，可注入为 Seedance 文生视频 prompt。";
  }
  return "将文本节点连线到本节点，在 prompt 中用 @文本N 或 Shift+单击参考条插入后再生成。";
}

export function videoUpstreamTextStatusMessage(sources: VideoUpstreamTextSource[]): string {
  if (sources.length === 0) {
    return "已连接上游文本节点，但正文为空。";
  }
  const total = sources.reduce((sum, s) => sum + s.charCount, 0);
  const names = sources.map((s) => `「${s.label}」`).join("、");
  return `上游 ${names}（约 ${total} 字）可注入为视频提示词。`;
}
