import { invoke } from "@tauri-apps/api/core";
import type { Edge } from "@xyflow/react";
import type { ImageStyleId } from "@/lib/imageGeneration/catalog";
import { parseApiSizeLabel } from "@/lib/imageGeneration/imageAspectSize";
import { buildImagePromptWithStyles } from "@/lib/imageGeneration/helpers";
import { parseImageGenerationRelPaths } from "@/lib/imageGeneration/parseImageGenerationResult";
import { spawnExtraImageOutputNodes } from "@/lib/imageGeneration/spawnMultiImageOutputNodes";
import {
  getScriptBeatIdFromParams,
  orderedIncomingScriptNodeIds,
} from "@/lib/incomingScriptBinding";
import {
  resolveVacantBeatsForSplitShots,
  writebackSpawnedImagesToStoryboard,
} from "@/lib/storyboard/splitSpawnedImagesIntoStoryboard";
import { writebackStoryboardShotImagePath } from "@/lib/storyboard/writebackStoryboardImage";
import { refreshDreaminaAuthOnGenerationFailure } from "@/lib/dreaminaAuthOnFailure";
import { startImageGenProgressTicker } from "@/lib/nodeAgentRuntime/imageGenProgress";
import type { NodeTaskAgentRuntime } from "@/lib/nodeAgentRuntime/types";
import { useProjectStore } from "@/store/projectStore";

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
  relPaths: string[];
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
    } catch (err) {
      refreshDreaminaAuthOnGenerationFailure(sensed.modelId);
      throw err;
    } finally {
      stopProgress();
    }
    const relPaths = parseImageGenerationRelPaths(rel);
    if (relPaths.length === 0) {
      throw new Error("图片生成返回为空路径");
    }
    const dims = sensed.resolution ? parseApiSizeLabel(sensed.resolution) : null;
    return {
      relPaths,
      imageWidth: dims?.width,
      imageHeight: dims?.height,
    };
  },
  validate: ({ relPaths, imageWidth, imageHeight }) => {
    if (relPaths.length === 0) throw new Error("图片生成返回为空路径");
    return { relPaths, imageWidth, imageHeight };
  },
  commit: ({ relPaths, imageWidth, imageHeight }, ctx) => {
    const primary = relPaths[0]!;
    ctx.updateNodeData(ctx.nodeId, {
      path: primary,
      ...(imageWidth && imageHeight ? { imageWidth, imageHeight } : {}),
    });

    const { nodes, edges, updateNodeData } = useProjectStore.getState();
    writebackStoryboardShotImagePath({
      nodes,
      edges: edges as Edge[],
      imageNodeId: ctx.nodeId,
      imageRelPath: primary,
      updateNodeData,
    });

    if (relPaths.length === 1) {
      ctx.setStatusText(`图片生成成功：${primary}`);
      return;
    }

    const extras = relPaths.slice(1);
    let splitAssignments: ReturnType<typeof resolveVacantBeatsForSplitShots> = [];
    const sourceNode = useProjectStore.getState().nodes.find((n) => n.id === ctx.nodeId);
    const anchorBeatId = sourceNode ? getScriptBeatIdFromParams(sourceNode.data) : null;
    const scriptIds = orderedIncomingScriptNodeIds(
      nodes,
      edges as Edge[],
      ctx.nodeId,
    );
    const scriptNode =
      anchorBeatId && scriptIds[0]
        ? nodes.find((n) => n.id === scriptIds[0] && n.type === "scriptNode")
        : undefined;
    if (scriptNode && anchorBeatId) {
      splitAssignments = resolveVacantBeatsForSplitShots({
        scriptNodeId: scriptNode.id,
        anchorBeatId,
        slotCount: extras.length,
        beats: scriptNode.data.scriptBeats ?? [],
        shots: scriptNode.data.storyboardShots,
        scriptBeatSelection: scriptNode.data.scriptBeatSelection,
        nodes,
        edges: edges as Edge[],
      });
    }

    const spawned = spawnExtraImageOutputNodes({
      sourceNodeId: ctx.nodeId,
      extraRelPaths: extras,
      imageWidth,
      imageHeight,
      splitShotAssignments: splitAssignments,
    });

    const latest = useProjectStore.getState();
    const ingested = writebackSpawnedImagesToStoryboard({
      assignments: spawned.map((nodeId, i) => ({
        imageNodeId: nodeId,
        relPath: extras[i]!,
      })),
      nodes: latest.nodes,
      edges: latest.edges as Edge[],
      updateNodeData,
    });

    const unbound = extras.length - splitAssignments.length;
    let detail = `已宫格排布为 ${1 + spawned.length} 个图片节点`;
    if (ingested > 0) detail += `，拆镜入库 ${ingested} 镜`;
    if (unbound > 0) detail += `（${unbound} 张未绑定后续空缺镜头）`;
    ctx.setStatusText(`已生成 ${relPaths.length} 张，${detail}`);
  },
};
