import type { IncomingImagePanelRef } from "@/lib/imageGeneration/types";
import { textContentFromUpstreamNode } from "@/lib/incomingScriptBinding";
import type { VideoIncomingRefItem } from "@/hooks/useVideoIncomingReferenceItems";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";

/** 面板参考条上的文本上游：@文本N / @[nodeId] / @节点名 → 正文 */
export type PanelTextRef = {
  sourceNodeId: string;
  label: string;
  content: string;
  panelToken: string;
  nodeToken: string;
  displayToken?: string;
};

export function panelTextRefReplacement(ref: PanelTextRef): string {
  const body = ref.content.trim();
  return body || `[${ref.label}: （空）]`;
}

export function buildImagePanelTextRefs(items: IncomingImagePanelRef[]): PanelTextRef[] {
  const out: PanelTextRef[] = [];
  items.forEach((item, index) => {
    if (item.kind !== "text") return;
    const slot = index + 1;
    const label = item.nodeLabel.trim() || "文本节点";
    out.push({
      sourceNodeId: item.sourceNodeId,
      label,
      content: item.textContent,
      panelToken: `@文本${slot}`,
      nodeToken: `@[${item.sourceNodeId}]`,
      displayToken: label ? `@${label}` : undefined,
    });
  });
  return out;
}

export function buildVideoPanelTextRefs(items: VideoIncomingRefItem[]): PanelTextRef[] {
  const out: PanelTextRef[] = [];
  items.forEach((item, index) => {
    if (item.kind !== "text") return;
    const slot = index + 1;
    const label = item.nodeLabel.trim() || "文本节点";
    out.push({
      sourceNodeId: item.sourceNodeId,
      label,
      content: item.textContent ?? "",
      panelToken: `@文本${slot}`,
      nodeToken: `@[${item.sourceNodeId}]`,
      displayToken: label ? `@${label}` : undefined,
    });
  });
  return out;
}

/** 将 prompt 内的 @ 文本引用替换为上游正文（生成前调用） */
export function expandPromptTextAtReferences(prompt: string, refs: PanelTextRef[]): string {
  if (!prompt || refs.length === 0) return prompt;

  const replacements: { token: string; content: string }[] = [];
  for (const ref of refs) {
    const content = panelTextRefReplacement(ref);
    replacements.push({ token: ref.panelToken, content });
    replacements.push({ token: ref.nodeToken, content });
    if (ref.displayToken) {
      replacements.push({ token: ref.displayToken, content });
    }
  }

  replacements.sort((a, b) => b.token.length - a.token.length);

  let out = prompt;
  for (const { token, content } of replacements) {
    if (!out.includes(token)) continue;
    out = out.split(token).join(content);
  }
  return out;
}

/** 文本 / LLM 节点 Composer：解析 @[nodeId] 为「标签: 正文」 */
export function resolveMentionNodeTokens(
  text: string,
  nodes: Node<FlowNodeData>[],
): string {
  return text.replace(/@\[([^\]]+)\]/g, (match, nodeId) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return match;
    const label = node.data?.label?.trim() || nodeId;
    const content = textContentFromUpstreamNode(node.data).trim();
    return content ? `[${label}: ${content}]` : `[${label}: （空）]`;
  });
}
