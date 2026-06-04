import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { buildPromptFromScriptBeatBinding } from "@/lib/incomingScriptBinding";
import { IMAGE_GENERATION_PROMPT_MAX_CHARS } from "@/lib/promptLimits";
import {
  collectIncomingImagePanelItems,
  MAX_INCOMING_IMAGE_TEXT_REFS,
} from "@/lib/imageGeneration/collectIncomingImagePanelItems";
import {
  orderIncomingImagePanelRefs,
  readImageReferenceEdgeOrder,
} from "@/lib/imageGeneration/imageReferenceEdgeOrder";

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
 * 上游文本顺序与参考条 referenceEdgeOrder 一致（无持久化顺序时按 Y）。
 */
export function aggregateImagePrompt(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  targetNodeId: string,
): AggregateImagePromptResult {
  const node = nodes.find((n) => n.id === targetNodeId);
  const localPrompt = (node?.data.prompt ?? "").trim();

  const scriptPart = buildPromptFromScriptBeatBinding(nodes, edges, targetNodeId)?.trim() ?? "";
  const { items } = collectIncomingImagePanelItems(nodes, edges, targetNodeId);
  const ordered = orderIncomingImagePanelRefs(
    items,
    readImageReferenceEdgeOrder(node?.data.params),
  );
  const textTruncated = ordered.filter((i) => i.kind === "text").length > MAX_INCOMING_IMAGE_TEXT_REFS;

  /** 上游文本仅通过 prompt 内 @文本N / 参考条插入带入，连线 alone 不拼正文 */
  const parts = dedupeAdjacent([scriptPart, localPrompt].filter(Boolean));
  const prompt = truncateAggregatedPrompt(parts, localPrompt);

  return { prompt: prompt.trim(), textTruncated };
}
