import { invoke, isTauri } from "@tauri-apps/api/core";
import { isEdgeDisabled } from "@/lib/edgeState";
import { formatUserError } from "@/lib/errors";
import { IMAGE_GENERATION_PROMPT_MAX_CHARS } from "@/lib/promptLimits";
import { resolveAssetRelPath } from "@/shared/api/assets";
import { loadEnabledProviderOptions } from "@/lib/textNodeProviders";
import type { FlowNodeData } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";

export const IMAGE_TO_PROMPT_INSTRUCTION =
  "根据图片生成结构化中文提示词，包括主体描述、环境、光影、镜头语言、风格关键词。";

export const VIDEO_TO_PROMPT_INSTRUCTION =
  "根据视频画面反推可用于文生视频的中文提示词，包括主体、动作、环境、镜头与风格关键词。";

/** 媒体节点 → 下游第一个文本节点（出边） */
export function findDownstreamTextNodeId(
  sourceNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): string | null {
  const targets = edges
    .filter((e) => !isEdgeDisabled(e) && e.source === sourceNodeId)
    .map((e) => e.target);
  for (const tid of targets) {
    if (nodes.find((n) => n.id === tid)?.type === "textNode") return tid;
  }
  return null;
}

export type MediaPromptReverseKind = "image" | "video";

type RunReverseParams = {
  sourceNodeId: string;
  mediaKind: MediaPromptReverseKind;
  projectPath: string | null;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  mediaPath?: string;
  mediaAssetId?: string;
  userInstruction?: string;
  updateNodeData: (id: string, patch: Partial<FlowNodeData>) => void;
  setStatusText: (text: string) => void;
};

export async function runMediaPromptReverseToText({
  sourceNodeId,
  mediaKind,
  projectPath,
  nodes,
  edges,
  mediaPath,
  mediaAssetId,
  userInstruction,
  updateNodeData,
  setStatusText,
}: RunReverseParams): Promise<boolean> {
  if (!isTauri()) {
    setStatusText("反推提示词需在桌面端运行");
    return false;
  }
  if (!projectPath?.trim()) {
    setStatusText("请先打开工程目录");
    return false;
  }

  const textNodeId = findDownstreamTextNodeId(sourceNodeId, nodes, edges);
  if (!textNodeId) {
    setStatusText("请先将本节点连线到下游文本节点");
    return false;
  }

  const rel = await resolveAssetRelPath(projectPath, mediaPath, mediaAssetId);
  if (!rel) {
    setStatusText(mediaKind === "image" ? "请先生成或上传图片" : "请先上传或生成视频");
    return false;
  }

  const instruction =
    userInstruction?.trim() ||
    (mediaKind === "image" ? IMAGE_TO_PROMPT_INSTRUCTION : VIDEO_TO_PROMPT_INSTRUCTION);

  const providers = await loadEnabledProviderOptions();
  const preferred = providers[0];

  const runningStatus = {
    status: "running" as const,
    updatedAt: Date.now(),
    agentName: mediaKind === "image" ? "图反推提示词" : "视频反推提示词",
    phase: "vision",
  };

  updateNodeData(textNodeId, { status: runningStatus });
  setStatusText(mediaKind === "image" ? "正在根据图片反推提示词…" : "正在根据视频反推提示词…");

  try {
    const content = await invoke<string>("reverse_prompt_from_media", {
      projectPath,
      mediaRelPath: rel,
      mediaKind,
      userInstruction: instruction,
      providerId: preferred?.id ?? null,
      model: preferred?.model ?? null,
    });
    const trimmed = content.trim().slice(0, IMAGE_GENERATION_PROMPT_MAX_CHARS);
    updateNodeData(textNodeId, {
      prompt: trimmed,
      status: {
        status: "succeeded",
        updatedAt: Date.now(),
        agentName: runningStatus.agentName,
      },
    });
    setStatusText(`已写入下游文本节点（${trimmed.length} 字）`);
    return true;
  } catch (e) {
    updateNodeData(textNodeId, {
      status: {
        status: "failed",
        updatedAt: Date.now(),
        agentName: runningStatus.agentName,
        error: formatUserError(e),
      },
    });
    setStatusText(`反推失败：${formatUserError(e)}`);
    return false;
  }
}
