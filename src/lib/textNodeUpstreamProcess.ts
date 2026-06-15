import { invoke, isTauri } from "@tauri-apps/api/core";
import { DESKTOP_SHELL_HINT } from "@/lib/tauriEnv";
import {
  orderedIncomingScriptNodeIds,
  orderedIncomingTextNodeIds,
  textContentFromUpstreamNode,
} from "@/lib/incomingScriptBinding";
import type { FlowNodeData, ScriptBeat } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";

export type UpstreamContextBlock = {
  nodeId: string;
  label: string;
  content: string;
};

const STORYBOARD_FORMAT_HINT =
  "如果用户要求生成分镜脚本，按竖屏短剧专业格式输出，并遵循以下决策顺序分析原文：\n" +
  "1) 空间场景 2) 人物数量与关系 3) 对话类型 4) 情绪 5) 动作复杂度 6) 节奏功能 7) 特殊镜头 8) 复合动作拆解 9) 题材套路\n" +
  "竖屏约束：双人前后错位、近景/特写为主、全景≤15%且≤3秒、关键内容居中70%安全区。\n" +
  "运镜仅用：固定、推/拉（慢/快）、摇、横移、跟拍（前/后/侧）、手持（微/中/强）。\n" +
  "复合动作（打斗、接吻、下跪、壁咚、掀桌、泼水等）须拆成多镜。\n" +
  "输出格式：\n" +
  "## [场景标题]（如 2-1 日 内 豪车上）\n" +
  "### 镜头 1\n" +
  "- **时长**：X秒（台词按字数/语速估算，愤怒快、悲伤可略长）\n" +
  "- **景别**：全景/中景/中近景/近景/特写/大特写\n" +
  "- **画面**：[描述]\n" +
  "- **镜头运动**：[标准化运镜]\n" +
  "- **台词**：[\"...\"] 或 无\n" +
  "- **声音**：[环境声/对白/电子音等]\n" +
  "- **剪辑重点**：[硬切/对切/叠化/动接动等]\n" +
  "### 镜头 2\n" +
  "...";

function formatScriptBeatsAsText(beats: ScriptBeat[]): string {
  const lines = beats.map((b) => {
    const sn = b.shotNumber?.trim() || "-";
    const dur = b.durationHint?.trim() || "-";
    const scene = b.sceneHeading?.trim() || "-";
    const shotSize = b.shotSize?.trim() || "-";
    const camera = b.cameraMove?.trim() || "-";
    const desc = b.description?.trim() || "-";
    const dialogue = b.dialogue?.trim() || "无";
    const dialogueType = b.dialogueType?.trim();
    const performance = b.performanceNote?.trim();
    const bgm = b.bgmHint?.trim();
    const rhythm = b.rhythmTag?.trim() || b.sceneTags?.trim();
    const rhythmPart = rhythm ? ` | 节奏：${rhythm}` : "";
    const dialogueTypePart = dialogueType ? ` | 对白类型 ${dialogueType}` : "";
    const performancePart = performance ? ` | 表演 ${performance}` : "";
    const bgmPart = bgm ? ` | BGM ${bgm}` : "";
    return `镜号 ${sn} | 场景 ${scene} | 时长 ${dur} | 景别 ${shotSize} | 运镜 ${camera}${rhythmPart}${dialogueTypePart}${performancePart}${bgmPart} | 画面：${desc} | 对白：${dialogue}`;
  });
  return `【结构化镜头表】\n${lines.join("\n")}`;
}

function formatScriptNodeUpstreamContent(data: FlowNodeData): string {
  const parts: string[] = [];
  const prompt = (data.prompt ?? "").trim();
  if (prompt) parts.push(prompt);
  const beats = data.scriptBeats ?? [];
  if (beats.length > 0) parts.push(formatScriptBeatsAsText(beats));
  return parts.join("\n\n").trim();
}

/** 收集直连上游文本 / 脚本节点正文（不触发 DAG 执行） */
export function gatherUpstreamContextForTextProcessing(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  targetNodeId: string,
): UpstreamContextBlock[] {
  const out: UpstreamContextBlock[] = [];

  for (const id of orderedIncomingTextNodeIds(nodes, edges, targetNodeId)) {
    const n = nodes.find((x) => x.id === id);
    if (!n) continue;
    const content = textContentFromUpstreamNode(n.data).trim();
    if (!content) continue;
    out.push({
      nodeId: id,
      label: n.data.label?.trim() || (n.type === "llm" ? "LLM" : "文本"),
      content,
    });
  }

  for (const id of orderedIncomingScriptNodeIds(nodes, edges, targetNodeId)) {
    const n = nodes.find((x) => x.id === id);
    if (!n || n.type !== "scriptNode") continue;
    const content = formatScriptNodeUpstreamContent(n.data);
    if (!content) continue;
    out.push({
      nodeId: id,
      label: n.data.label?.trim() || "脚本",
      content,
    });
  }

  return out;
}

export function hasUpstreamForTextProcessing(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  targetNodeId: string,
): boolean {
  return gatherUpstreamContextForTextProcessing(nodes, edges, targetNodeId).length > 0;
}

type ProcessParams = {
  nodeId: string;
  instruction: string;
  priorResult: string;
  upstreamBlocks: UpstreamContextBlock[];
  providerId?: string;
  model?: string;
};

/** 直接调用 LLM 处理上游文本，不跑 DAG（避免误触发脚本节点 / 下游节点） */
export async function runTextNodeUpstreamLlmProcess({
  instruction,
  priorResult,
  upstreamBlocks,
  providerId,
  model,
}: ProcessParams): Promise<string> {
  if (!isTauri()) {
    throw new Error(DESKTOP_SHELL_HINT);
  }
  const trimmedInstruction = instruction.trim();
  if (!trimmedInstruction) {
    throw new Error("请输入处理指令");
  }
  if (upstreamBlocks.length === 0) {
    throw new Error("未检测到上游文本或脚本内容，请先连线");
  }

  const upstreamText = upstreamBlocks
    .map((b) => `### ${b.label}\n\n${b.content}`)
    .join("\n\n---\n\n");

  const systemPrompt = [
    "你是一个专业的文本分析与处理助手。请严格按照用户指令，对「上游文本」进行精准处理。",
    "",
    "核心规则：",
    "- 只返回处理结果，不添加任何解释、前言或客套话",
    "- 使用清晰的结构化 Markdown 格式呈现结果",
    "- 如果用户要求提取信息，使用分类列表或键值对形式",
    STORYBOARD_FORMAT_HINT,
    "",
    "## 上游文本",
    "",
    upstreamText,
  ].join("\n");

  let userPrompt = trimmedInstruction;
  if (priorResult.trim()) {
    userPrompt = `【上一轮处理结果】\n${priorResult.trim()}\n\n【本轮指令】\n${trimmedInstruction}`;
  }

  const raw = await invoke<string>("llm_complete_text", {
    systemPrompt,
    userPrompt,
    providerId: providerId?.trim() || undefined,
    model: model?.trim() || undefined,
  });

  const text = (raw ?? "").trim();
  if (!text) {
    throw new Error("模型未返回有效内容");
  }
  return text;
}
