import { invoke } from "@tauri-apps/api/core";
import { resolveAssetRelPath } from "@/shared/api/assets";
import type { NodeTaskAgentRuntime } from "@/lib/nodeAgentRuntime/types";

type ImageGenerationAgentInput = {
  prompt: string;
  modelId: string;
  customModels: Array<{ id: string; label: string; model: string; priority: number; enabled: boolean }>;
  task: string;
  referenceImagePath?: string;
  referenceImageAssetId?: string;
};

type ImageGenerationSensed = {
  prompt: string;
  modelId: string;
  task: string;
  customModels: ImageGenerationAgentInput["customModels"];
  referenceImagePath?: string;
  referenceImageAssetId?: string;
};

type ImageGenerationExecuted = {
  rel: string;
};

/**
 * 图片节点单任务 Agent：生成并回写 path。
 */
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
    return {
      prompt,
      modelId: input.modelId,
      task: input.task,
      customModels: input.customModels,
      referenceImagePath: input.referenceImagePath,
      referenceImageAssetId: input.referenceImageAssetId,
    };
  },
  execute: async (sensed, ctx) => {
    const taskNeedsRef = sensed.task !== "text_to_image";
    const refResolved = await resolveAssetRelPath(
      ctx.projectPath,
      sensed.referenceImagePath,
      sensed.referenceImageAssetId,
    );
    if (taskNeedsRef && !refResolved) {
      throw new Error("无法解析参考图路径，请检查素材是否已导入。");
    }
    ctx.setStatusText("正在调用图片模型生成…");
    const rel = await invoke<string>("generate_image_asset", {
      projectPath: ctx.projectPath,
      prompt: sensed.prompt,
      imageModelId: sensed.modelId.startsWith("custom:") ? sensed.modelId.slice("custom:".length) : null,
      model: sensed.modelId.startsWith("custom:")
        ? sensed.customModels.find((x) => `custom:${x.id}` === sensed.modelId)?.model ?? ""
        : sensed.modelId,
      task: sensed.task,
      referenceImagePaths: refResolved ? [refResolved] : [],
    });
    return { rel };
  },
  validate: ({ rel }) => {
    const out = rel.trim();
    if (!out) throw new Error("图片生成返回为空路径");
    return { rel: out };
  },
  commit: ({ rel }, ctx) => {
    ctx.updateNodeData(ctx.nodeId, { path: rel });
    ctx.setStatusText(`图片生成成功：${rel}`);
  },
};

