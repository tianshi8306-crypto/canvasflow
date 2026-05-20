import { invoke } from "@tauri-apps/api/core";
import type { ImageStyleId } from "@/lib/imageGeneration/catalog";
import { parseApiSizeLabel } from "@/lib/imageGeneration/imageAspectSize";
import { buildImagePromptWithStyles } from "@/lib/imageGeneration/helpers";
import { startImageGenProgressTicker } from "@/lib/nodeAgentRuntime/imageGenProgress";
import type { NodeTaskAgentRuntime } from "@/lib/nodeAgentRuntime/types";

type ImageGenerationAgentInput = {
  prompt: string;
  modelId: string;
  customModels: Array<{ id: string; label: string; model: string; priority: number; enabled: boolean }>;
  task: string;
  /** 已解析的工程相对路径列表 */
  referenceImagePaths: string[];
  count?: number;
  aspect?: string;
  resolution?: string;
  negativePrompt?: string;
  styleIds?: ImageStyleId[];
};

type ImageGenerationSensed = {
  prompt: string;
  modelId: string;
  task: string;
  customModels: ImageGenerationAgentInput["customModels"];
  referenceImagePaths: string[];
  aspect?: string;
  resolution?: string;
  count?: number;
  negativePrompt?: string;
  styleIds?: ImageStyleId[];
};

type ImageGenerationExecuted = {
  rel: string;
  imageWidth?: number;
  imageHeight?: number;
};

export const imageGenerationAgentRuntime: NodeTaskAgentRuntime<
  ImageGenerationAgentInput,
  ImageGenerationSensed,
  ImageGenerationExecuted,
  ImageGenerationExecuted
> = {
  agentName: "图片 Agent",
  sense: (input) => {
    const prompt = input.prompt.trim();
    if (!prompt) {
      throw new Error("请输入图片提示词。");
    }
    const referenceImagePaths = input.referenceImagePaths.map((p) => p.trim()).filter(Boolean);
    return {
      prompt,
      modelId: input.modelId,
      task: input.task,
      customModels: input.customModels,
      referenceImagePaths,
      aspect: input.aspect,
      resolution: input.resolution,
      count: input.count,
      negativePrompt: input.negativePrompt?.trim() || undefined,
      styleIds: input.styleIds?.length ? input.styleIds : undefined,
    };
  },
  execute: async (sensed, ctx) => {
    const taskNeedsRef =
      sensed.task === "image_to_image" ||
      sensed.task === "multi_ref_fusion" ||
      sensed.task === "image_edit";
    if (taskNeedsRef && sensed.referenceImagePaths.length === 0) {
      throw new Error("无法解析参考图路径，请检查素材是否已导入。");
    }
    const finalPrompt = buildImagePromptWithStyles(sensed.prompt, sensed.styleIds ?? []);
    ctx.setStatusText("正在调用图片模型生成…");
    const stopProgress = startImageGenProgressTicker(ctx);
    let rel: string;
    try {
      rel = await invoke<string>("generate_image_asset", {
        projectPath: ctx.projectPath,
        prompt: finalPrompt,
        imageModelId: sensed.modelId.startsWith("custom:")
          ? sensed.modelId.slice("custom:".length)
          : null,
        model: sensed.modelId.startsWith("custom:")
          ? sensed.customModels.find((x) => `custom:${x.id}` === sensed.modelId)?.model ?? ""
          : sensed.modelId,
        task: sensed.task,
        referenceImagePaths: sensed.referenceImagePaths,
        aspect: sensed.aspect,
        resolution: sensed.resolution,
        count: sensed.count,
        negativePrompt: sensed.negativePrompt,
      });
    } finally {
      stopProgress();
    }
    const dims = sensed.resolution ? parseApiSizeLabel(sensed.resolution) : null;
    return {
      rel,
      imageWidth: dims?.width,
      imageHeight: dims?.height,
    };
  },
  validate: ({ rel, imageWidth, imageHeight }) => {
    const out = rel.trim();
    if (!out) throw new Error("图片生成返回为空路径");
    return { rel: out, imageWidth, imageHeight };
  },
  commit: ({ rel, imageWidth, imageHeight }, ctx) => {
    ctx.updateNodeData(ctx.nodeId, {
      path: rel,
      ...(imageWidth && imageHeight ? { imageWidth, imageHeight } : {}),
    });
    ctx.setStatusText(`图片生成成功：${rel}`);
  },
};
