import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { isEdgeDisabled } from "@/lib/edgeState";
import { buildPromptFromScriptBeatBinding } from "@/lib/incomingScriptBinding";
import { IMAGE_GENERATION_PROMPT_MAX_CHARS } from "@/lib/promptLimits";

const MAX_UPSTREAM_TEXT_SEGMENTS = 3;
const TEXT_SOURCE_TYPES = new Set(["textNode", "llm"]);

function dedupeAdjacent(parts: string[]): string[] {
  const out: string[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    if (out.length > 0 && out[out.length - 1] === t) continue;
    out.push(t);
  }
  return out;
}

function collectUpstreamTextSegments(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  targetNodeId: string,
): { segments: string[]; truncated: boolean } {
  const incoming = edges.filter(
    (e) =>
      !isEdgeDisabled(e) &&
      e.target === targetNodeId &&
      (!e.targetHandle || e.targetHandle === "in"),
  );

  const items: { y: number; text: string }[] = [];
  const seen = new Set<string>();

  for (const e of incoming) {
    if (seen.has(e.source)) continue;
    const n = nodes.find((x) => x.id === e.source);
    if (!n?.type || !TEXT_SOURCE_TYPES.has(n.type)) continue;
    const text = (n.data.prompt ?? "").trim();
    if (!text) continue;
    seen.add(e.source);
    items.push({ y: n.position.y, text });
  }

  items.sort((a, b) => a.y - b.y);
  const truncated = items.length > MAX_UPSTREAM_TEXT_SEGMENTS;
  const segments = items.slice(0, MAX_UPSTREAM_TEXT_SEGMENTS).map((i) => i.text);
  return { segments, truncated };
}

/** 超长时保留尾部「本节点 prompt」整段，前部从前往后填充。 */
function truncateAggregatedPrompt(parts: string[], localPrompt: string): string {
  const local = localPrompt.trim();
  const headParts = parts.filter((p) => p.trim() && p.trim() !== local);
  const max = IMAGE_GENERATION_PROMPT_MAX_CHARS;

  if (!local) {
    return headParts.join("\n\n").slice(0, max);
  }

  if (local.length >= max) {
    return local.slice(0, max);
  }

  let budget = max - local.length;
  const kept: string[] = [];
  for (const p of headParts) {
    const t = p.trim();
    if (!t) continue;
    const sep = kept.length > 0 ? 2 : 0;
    if (t.length + sep > budget) {
      const room = budget - sep;
      if (room > 0) kept.push(t.slice(0, room));
      break;
    }
    kept.push(t);
    budget -= t.length + sep;
  }

  const head = kept.join("\n\n");
  return head ? `${head}\n\n${local}` : local;
}

export type AggregateImagePromptResult = {
  prompt: string;
  textTruncated: boolean;
};

/**
 * 按规格 §3 聚合图片生成提示词（同步，不含风格后缀）。
 */
export function aggregateImagePrompt(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  targetNodeId: string,
): AggregateImagePromptResult {
  const node = nodes.find((n) => n.id === targetNodeId);
  const localPrompt = (node?.data.prompt ?? "").trim();

  const scriptPart = buildPromptFromScriptBeatBinding(nodes, edges, targetNodeId)?.trim() ?? "";
  const { segments, truncated: textTruncated } = collectUpstreamTextSegments(nodes, edges, targetNodeId);

  const parts = dedupeAdjacent([scriptPart, ...segments, localPrompt].filter(Boolean));
  const prompt = truncateAggregatedPrompt(parts, localPrompt);

  return { prompt: prompt.trim(), textTruncated };
}
