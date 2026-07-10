import { normalizeTextPromptMarkdown } from "@/lib/textPromptMarkdown";
import { reconcileBeatsPromptFields } from "@/lib/scriptPromptSynthesis";
import type { FlowNodeData, ScriptBeat } from "@/lib/types";
import type { Node } from "@xyflow/react";

const PROMPT_BODY_NODE_TYPES = new Set(["textNode", "llm"]);

/** 合并 DAG/LLM 回写 patch 时规范化文本节点正文；脚本节点镜头表做提示词字段 reconcile */
export function mergeTextNodeDataPatch(
  nodeType: string | undefined,
  dataPatch: Partial<FlowNodeData>,
): Partial<FlowNodeData> {
  let patch = dataPatch;
  if (nodeType === "scriptNode" && Array.isArray(patch.scriptBeats)) {
    patch = {
      ...patch,
      scriptBeats: reconcileBeatsPromptFields(patch.scriptBeats as ScriptBeat[]),
    };
  }
  if (!nodeType || !PROMPT_BODY_NODE_TYPES.has(nodeType)) return patch;
  if (typeof patch.prompt !== "string") return patch;
  const normalized = normalizeTextPromptMarkdown(patch.prompt);
  return normalized === patch.prompt ? patch : { ...patch, prompt: normalized };
}

export function normalizeTextPromptForNode(
  nodeType: string | undefined,
  prompt: string,
): string {
  if (!nodeType || !PROMPT_BODY_NODE_TYPES.has(nodeType)) return prompt;
  return normalizeTextPromptMarkdown(prompt);
}

export function applyTextNodeDataPatch(
  node: Node<FlowNodeData>,
  dataPatch: Partial<FlowNodeData>,
): Node<FlowNodeData> {
  const merged = mergeTextNodeDataPatch(node.type, dataPatch);
  return { ...node, data: { ...node.data, ...merged } };
}
