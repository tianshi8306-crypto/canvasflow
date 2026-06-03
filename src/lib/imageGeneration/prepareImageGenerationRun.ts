import type { Edge, Node } from "@xyflow/react";
import { invoke } from "@tauri-apps/api/core";
import {
  normalizeImageGenerationCount,
  type ImageStyleId,
} from "@/lib/imageGeneration/catalog";
import {
  applyModelImageTaskCapabilities,
  imageModelCapabilitiesFromConfig,
} from "@/lib/imageGeneration/applyModelImageTaskCapabilities";
import { resolveImageApiSize } from "@/lib/imageGeneration/imageAspectSize";
import { readImageOutputParams } from "@/lib/imageGeneration/imageOutputParams";
import {
  parseImageStyleIdsFromPrompt,
  stripImageStyleTokensFromPrompt,
} from "@/lib/imageGeneration/imageStyleTokens";
import { resolveImageGenerationContext } from "@/lib/imageGeneration/resolveImageGenerationContext";
import { collectIncomingImagePanelItems } from "@/lib/imageGeneration/collectIncomingImagePanelItems";
import {
  orderIncomingImagePanelRefs,
  readImageReferenceEdgeOrder,
} from "@/lib/imageGeneration/imageReferenceEdgeOrder";
import {
  buildImagePanelTextRefs,
  expandPromptTextAtReferences,
} from "@/lib/promptUpstreamTextRefs";
import type { ImageModelOption } from "@/hooks/useImageModels";
import {
  buildBuiltinImageModels,
  normalizeImageModelsFromSettings,
} from "@/lib/imageGeneration/imageModelOptions";
import { IMAGE_GENERATION_PROMPT_MAX_CHARS } from "@/lib/promptLimits";
import type { FlowNodeData } from "@/lib/types";
import type { AppSettings } from "@/lib/settingsPanelTypes";

export type PreparedImageGenerationRun = {
  input: {
    prompt: string;
    modelId: string;
    customModels: Array<{
      id: string;
      label: string;
      model: string;
      priority: number;
      enabled: boolean;
    }>;
    task: string;
    referenceImagePaths: string[];
    count?: number;
    aspect?: string;
    resolution?: string;
    styleIds?: ImageStyleId[];
  };
};

export async function loadMergedImageModels(): Promise<ImageModelOption[]> {
  try {
    const raw = await invoke<AppSettings>("load_settings");
    const custom = normalizeImageModelsFromSettings(raw.imageModels ?? []);
    const customModelIds = new Set(custom.map((m) => m.model.trim()).filter(Boolean));
    return [
      ...buildBuiltinImageModels().filter((b) => !customModelIds.has(b.model)),
      ...custom,
    ];
  } catch {
    return buildBuiltinImageModels();
  }
}

function resolveValidModelId(
  models: ImageModelOption[],
  params: Record<string, unknown> | undefined,
): string {
  const raw = params?.imageModelId;
  const modelId = typeof raw === "string" ? raw : "";
  if (modelId && models.some((m) => m.id === modelId && m.enabled)) return modelId;
  return models.find((m) => m.enabled)?.id ?? "";
}

/**
 * 为指定图片节点解析生成上下文并组装 Agent 入参（与 `ImageGenerationPanel` 生成钮一致）。
 */
export async function prepareImageGenerationRun(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  imageNodeId: string,
  projectPath: string,
): Promise<{ ok: true; prepared: PreparedImageGenerationRun } | { ok: false; reason: string }> {
  const node = nodes.find((n) => n.id === imageNodeId);
  if (!node || node.type !== "imageNode") {
    return { ok: false, reason: "目标不是图片节点" };
  }

  const promptRaw = (node.data.prompt ?? "").slice(0, IMAGE_GENERATION_PROMPT_MAX_CHARS);
  const ctxBase = await resolveImageGenerationContext(nodes, edges, imageNodeId, projectPath);
  const models = await loadMergedImageModels();
  const model = models.find((m) => m.id === resolveValidModelId(models, node.data.params as Record<string, unknown>));
  const caps = imageModelCapabilitiesFromConfig(
    model
      ? {
          supportsMultiRefFusion: model.supportsMultiRefFusion,
          maxReferenceImages: model.maxReferenceImages,
          supportsImageEdit: model.supportsImageEdit,
        }
      : undefined,
  );
  const ctx = applyModelImageTaskCapabilities(ctxBase, caps);

  if (ctx.blockReason) return { ok: false, reason: ctx.blockReason };

  const stripped = stripImageStyleTokensFromPrompt(promptRaw).trim();
  const { items: rawPanelItems } = collectIncomingImagePanelItems(nodes, edges, imageNodeId);
  const orderedPanelItems = orderIncomingImagePanelRefs(
    rawPanelItems,
    readImageReferenceEdgeOrder(
      node.data.params && typeof node.data.params === "object"
        ? (node.data.params as Record<string, unknown>)
        : undefined,
    ),
  );
  const textRefs = buildImagePanelTextRefs(orderedPanelItems);
  const effectiveRaw = ctx.aggregatedPrompt.trim() || stripped;
  const effective = expandPromptTextAtReferences(effectiveRaw, textRefs);
  if (!effective) return { ok: false, reason: "请输入图片提示词" };
  if (!ctx.task) return { ok: false, reason: "无法推断图片生成任务" };

  const params =
    node.data.params && typeof node.data.params === "object" && !Array.isArray(node.data.params)
      ? (node.data.params as Record<string, unknown>)
      : {};
  const outputParams = readImageOutputParams(params);
  const imageCountRaw = params.imageCount;
  const count = normalizeImageGenerationCount(imageCountRaw);
  const apiSize = resolveImageApiSize(
    outputParams.aspect,
    outputParams.resolution,
    node.data.imageWidth,
    node.data.imageHeight,
  );

  const modelId = resolveValidModelId(models, params);
  if (!modelId) return { ok: false, reason: "未配置可用的图片模型" };

  const customModels = models
    .filter((m) => m.settingsId)
    .map((m) => ({
      id: m.settingsId!,
      label: m.label,
      model: m.model,
      priority: m.priority,
      enabled: m.enabled,
    }));

  return {
    ok: true,
    prepared: {
      input: {
        prompt: stripped || effective,
        modelId,
        customModels,
        task: ctx.task,
        referenceImagePaths: ctx.referenceImagePaths,
        count,
        aspect: outputParams.aspect,
        resolution: apiSize,
        styleIds: parseImageStyleIdsFromPrompt(promptRaw),
      },
    },
  };
}
