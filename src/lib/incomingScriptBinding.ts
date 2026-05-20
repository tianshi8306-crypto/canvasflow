import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { isEdgeDisabled } from "@/lib/edgeState";

/** Kahn 拓扑序；含环或非法边时返回 null。 */
export function topologicalOrderIds(nodes: Node<FlowNodeData>[], edges: Edge[]): string[] | null {
  const ids = new Set(nodes.map((n) => n.id));
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const id of ids) {
    adj.set(id, []);
    indeg.set(id, 0);
  }
  for (const e of edges) {
    if (isEdgeDisabled(e)) continue;
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }
  const q: string[] = [];
  for (const [id, d] of indeg) {
    if (d === 0) q.push(id);
  }
  const out: string[] = [];
  while (q.length) {
    const u = q.shift()!;
    out.push(u);
    for (const v of adj.get(u) ?? []) {
      const nv = (indeg.get(v) ?? 0) - 1;
      indeg.set(v, nv);
      if (nv === 0) q.push(v);
    }
  }
  if (out.length !== nodes.length) return null;
  return out;
}

/** 指向 `targetNodeId` 的上游 `scriptNode` id（按全图拓扑序，越早越靠前）。 */
export function orderedIncomingScriptNodeIds(
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
    if (n?.type !== "scriptNode") continue;
    if (seen.has(e.source)) continue;
    seen.add(e.source);
    pairs.push({ r: rank.get(e.source) ?? 0, id: e.source });
  }
  pairs.sort((a, b) => a.r - b.r);
  return pairs.map((p) => p.id);
}

export type IncomingScriptUpstreamState = "none" | "enabled" | "disabled_only";

/**
 * 目标节点是否连接了上游脚本节点：
 * - enabled: 至少有 1 条启用连线
 * - disabled_only: 仅存在被禁用连线
 * - none: 完全无上游脚本连线
 */
export function incomingScriptUpstreamState(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  targetNodeId: string,
): IncomingScriptUpstreamState {
  let hasAny = false;
  let hasEnabled = false;
  for (const e of edges) {
    if (e.target !== targetNodeId) continue;
    const source = nodes.find((n) => n.id === e.source);
    if (source?.type !== "scriptNode") continue;
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

export function scriptSyncButtonTitle(
  upstream: IncomingScriptUpstreamState,
  normalTitle: string,
): string {
  if (upstream === "disabled_only") return "未检测到有效上游：当前脚本连线已禁用";
  return normalTitle;
}

export function scriptSyncDisabledOnlyStatus(actionLabel: string): string {
  return `无法${actionLabel}：仅检测到已禁用的上游脚本连线，请先启用连线`;
}

export function inspectorScriptUpstreamHint(upstream: IncomingScriptUpstreamState): string {
  if (upstream === "disabled_only") {
    return "仅检测到已禁用的上游脚本连线，当前不会参与同步与推导。";
  }
  if (upstream === "none") {
    return "未检测到上游脚本连线，自动同步提示词功能不可用。";
  }
  return "已检测到有效上游脚本连线，可使用自动同步提示词。";
}

function paramsRecord(data: FlowNodeData): Record<string, unknown> {
  const p = data.params;
  return p && typeof p === "object" && !Array.isArray(p) ? { ...p } : {};
}

/** 从节点 `data.params` 读取 `scriptBeatId`（非空字符串）。 */
export function getScriptBeatIdFromParams(data: FlowNodeData): string | undefined {
  const raw = paramsRecord(data).scriptBeatId;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

/**
 * 根据已绑定的 `scriptBeatId` 与直连上游脚本节点，拼出适合图片/音频提示的文案（分镜优先，否则脚本描述）。
 */
export function buildPromptFromScriptBeatBinding(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  mediaNodeId: string,
): string | null {
  const node = nodes.find((n) => n.id === mediaNodeId);
  if (!node || (node.type !== "imageNode" && node.type !== "audioNode")) return null;
  const beatId = getScriptBeatIdFromParams(node.data);
  if (!beatId) return null;
  const scriptIds = orderedIncomingScriptNodeIds(nodes, edges, mediaNodeId);
  const scriptNode = scriptIds
    .map((id) => nodes.find((n) => n.id === id))
    .find((n) => n?.type === "scriptNode");
  if (!scriptNode) return null;
  const beats = scriptNode.data.scriptBeats ?? [];
  const beat = beats.find((b) => b.id === beatId);
  if (!beat) return null;
  const shots = scriptNode.data.storyboardShots ?? [];
  const shot = shots.find((s) => s.scriptBeatId === beatId);
  const fromShot = shot?.visualPrompt?.trim();
  const fromBeat = beat.description?.trim();
  const text = (fromShot || fromBeat || "").trim();
  return text.length > 0 ? text : null;
}

/**
 * 与 M5 试点一致：分镜/描述 + 可选 `videoMotionPrompt` 行，写入文生视频草稿 `prompt`。
 */
export function buildVideoDraftPromptFromScriptBeatBinding(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  videoNodeId: string,
): string | null {
  const node = nodes.find((n) => n.id === videoNodeId);
  if (node?.type !== "videoNode") return null;
  const beatId = getScriptBeatIdFromParams(node.data);
  if (!beatId) return null;
  const scriptIds = orderedIncomingScriptNodeIds(nodes, edges, videoNodeId);
  const scriptNode = scriptIds
    .map((id) => nodes.find((n) => n.id === id))
    .find((n) => n?.type === "scriptNode");
  if (!scriptNode) return null;
  const beats = scriptNode.data.scriptBeats ?? [];
  const beat = beats.find((b) => b.id === beatId);
  if (!beat) return null;
  const shots = scriptNode.data.storyboardShots ?? [];
  const shot = shots.find((s) => s.scriptBeatId === beatId);
  const main = shot?.visualPrompt?.trim() || beat.description?.trim() || "";
  const motion = beat.videoMotionPrompt?.trim();
  const parts = [main, motion ? `运镜：${motion}` : ""].filter((s) => s.length > 0);
  const text = parts.join("\n").trim();
  return text.length > 0 ? text : null;
}

/** 台词 + 音效，供音频节点 TTS 文案区「从脚本同步」。 */
export function buildAudioTtsTextFromScriptBeatBinding(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  audioNodeId: string,
): string | null {
  const node = nodes.find((n) => n.id === audioNodeId);
  if (node?.type !== "audioNode") return null;
  const beatId = getScriptBeatIdFromParams(node.data);
  if (!beatId) return null;
  const scriptIds = orderedIncomingScriptNodeIds(nodes, edges, audioNodeId);
  const scriptNode = scriptIds
    .map((id) => nodes.find((n) => n.id === id))
    .find((n) => n?.type === "scriptNode");
  if (!scriptNode) return null;
  const beats = scriptNode.data.scriptBeats ?? [];
  const beat = beats.find((b) => b.id === beatId);
  if (!beat) return null;
  const dialogue = (beat.dialogue ?? "").trim();
  const sfx = (beat.soundEffect ?? "").trim();
  const parts = [dialogue, sfx].filter((s) => s.length > 0);
  if (parts.length === 0) return null;
  return parts.join("\n");
}

/** 获取直连上游脚本节点的内容，供 TextNode「从脚本同步」使用。 */
export function buildTextPromptFromScriptBinding(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  textNodeId: string,
): string | null {
  const node = nodes.find((n) => n.id === textNodeId);
  if (node?.type !== "textNode") return null;
  const scriptIds = orderedIncomingScriptNodeIds(nodes, edges, textNodeId);
  const scriptNode = scriptIds
    .map((id) => nodes.find((n) => n.id === id))
    .find((n) => n?.type === "scriptNode");
  if (!scriptNode) return null;
  const content = (scriptNode.data.prompt ?? "").trim();
  return content.length > 0 ? content : null;
}
