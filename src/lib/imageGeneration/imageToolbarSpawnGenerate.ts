import { dreaminaCliModelId } from "@/lib/dreamina/cliModels";
import type { ImageAspectId, ImageResolutionTierId } from "@/lib/imageGeneration/catalog";
import { resolveImageApiSize } from "@/lib/imageGeneration/imageAspectSize";
import {
  patchImageOutputParams,
} from "@/lib/imageGeneration/imageOutputParams";
import {
  loadMergedImageModels,
  prepareImageGenerationRun,
} from "@/lib/imageGeneration/prepareImageGenerationRun";
import { imageGenerationAgentRuntime } from "@/lib/nodeAgentRuntime/imageGenerationAgent";
import { runNodeTaskAgent } from "@/lib/nodeAgentRuntime/runNodeTaskAgent";
import type { ImageModelOption } from "@/hooks/useImageModels";
import { IMAGE_GENERATION_PROMPT_MAX_CHARS } from "@/lib/promptLimits";
import { useProjectStore } from "@/store/projectStore";

/** 工具栏派生图节点固定输出比例（与上游源图比例无关） */
export const IMAGE_TOOLBAR_SPAWN_OUTPUT_ASPECT: ImageAspectId = "16:9";
/** 工具栏派生图节点固定分辨率 */
export const IMAGE_TOOLBAR_SPAWN_OUTPUT_RESOLUTION: ImageResolutionTierId = "4K";
/** 优先使用的图片模型：即梦 CLI 5.0 */
export const IMAGE_TOOLBAR_SPAWN_PREFERRED_MODEL = dreaminaCliModelId("5.0");

const IMAGE_MODEL_PARAM_KEY = "imageModelId";

export function pickToolbarSpawnImageModelId(models: ImageModelOption[]): string | null {
  const preferred = models.find(
    (m) =>
      m.enabled &&
      (m.id === IMAGE_TOOLBAR_SPAWN_PREFERRED_MODEL ||
        m.model.trim() === IMAGE_TOOLBAR_SPAWN_PREFERRED_MODEL),
  );
  if (preferred) return preferred.id;
  return models.find((m) => m.enabled)?.id ?? null;
}

function patchToolbarSpawnNodeParams(
  prev: Record<string, unknown> | undefined,
  modelId: string,
): Record<string, unknown> {
  return {
    ...patchImageOutputParams(prev, {
      aspect: IMAGE_TOOLBAR_SPAWN_OUTPUT_ASPECT,
      resolution: IMAGE_TOOLBAR_SPAWN_OUTPUT_RESOLUTION,
    }),
    [IMAGE_MODEL_PARAM_KEY]: modelId,
  };
}/** 角色三视图：图生图固定提示词（预览工具栏「九宫格 → 角色三视图」） */
export const PERSON_3VIEW_SPAWN_PROMPT =
  "生成图中人物的真人形象三视图，白底图，左侧部分展示了角色的精细真人特写肖像。其面部特征、骨骼结构、神态表情、发型及头部配饰必须与 严格一致，呈现自然的皮肤纹理、毛孔和发丝细节，高解析保留毛孔、细纹、绒毛、眉睫、不磨皮、不锐化过头、不做人像美容，摄影棚质感，需要完全正脸，无动作，真人定妆照。右侧部分展示了该角色完全相同的超写实全身真人照片，呈现全身精致超写实的服装，呈标准 A-pose 站姿，并以精确的三视图排列：正视图、侧视图和背面图。超模的身体比例、完整的服装设计、布料层次、鞋子及整体穿搭风格必须严格遵循。所有服装和配饰均呈现真实的物理材质质感。";

export const IMAGE_TOOLBAR_SPAWN_CONFIG: Record<
  string,
  { prompt: string; label: string; statusStarting: string }
> = {
  person3view: {
    prompt: PERSON_3VIEW_SPAWN_PROMPT,
    label: "角色三视图",
    statusStarting: "正在生成角色三视图…",
  },
};

/**
 * 预览工具栏：在源图片节点右侧新建下游图片节点、连线，并立即图生图。
 */
export async function runImageToolbarSpawnGenerate(opts: {
  sourceNodeId: string;
  spawnId: string;
}): Promise<boolean> {
  const config = IMAGE_TOOLBAR_SPAWN_CONFIG[opts.spawnId];
  if (!config) {
    useProjectStore.getState().setStatusText("未找到对应生成配置");
    return false;
  }

  const store = useProjectStore.getState();
  const { projectPath, nodes, updateNodeData, setStatusText, spawnAnchoredPartner } = store;

  if (!projectPath?.trim()) {
    setStatusText("请先新建或打开工程目录后再生成图片。");
    return false;
  }

  const source = nodes.find((n) => n.id === opts.sourceNodeId);
  if (!source || source.type !== "imageNode") {
    setStatusText("源节点不是图片节点");
    return false;
  }
  if (!source.data.path?.trim() && !source.data.assetId?.trim()) {
    setStatusText("请先有预览图再生成三视图");
    return false;
  }

  const models = await loadMergedImageModels();
  const modelId = pickToolbarSpawnImageModelId(models);
  if (!modelId) {
    setStatusText("未配置可用的图片模型（请启用即梦 CLI 5.0 或其它模型）");
    return false;
  }

  const newId = spawnAnchoredPartner({
    anchorNodeId: opts.sourceNodeId,
    direction: "outgoing",
    partnerType: "imageNode",
  });
  if (!newId) return false;

  const prompt = config.prompt.slice(0, IMAGE_GENERATION_PROMPT_MAX_CHARS);
  const spawnedNode = useProjectStore.getState().nodes.find((n) => n.id === newId);
  const prevParams =
    spawnedNode?.data.params && typeof spawnedNode.data.params === "object"
      ? (spawnedNode.data.params as Record<string, unknown>)
      : undefined;
  updateNodeData(newId, {
    prompt,
    label: config.label,
    params: patchToolbarSpawnNodeParams(prevParams, modelId),
  });
  setStatusText(config.statusStarting);

  const latest = useProjectStore.getState();
  const prepared = await prepareImageGenerationRun(
    latest.nodes,
    latest.edges,
    newId,
    projectPath,
  );
  if (!prepared.ok) {
    setStatusText(prepared.reason);
    return false;
  }

  const apiSize = resolveImageApiSize(
    IMAGE_TOOLBAR_SPAWN_OUTPUT_ASPECT,
    IMAGE_TOOLBAR_SPAWN_OUTPUT_RESOLUTION,
  );

  const input = {
    ...prepared.prepared.input,
    prompt,
    modelId,
    aspect: IMAGE_TOOLBAR_SPAWN_OUTPUT_ASPECT,
    resolution: apiSize,
    ...(prepared.prepared.input.referenceImagePaths.length > 0
      ? { task: "image_to_image" as const }
      : {}),
  };
  try {
    await runNodeTaskAgent(imageGenerationAgentRuntime, input, {
      nodeId: newId,
      projectPath,
      updateNodeData: latest.updateNodeData,
      setStatusText,
    });
    return true;
  } catch {
    return false;
  }
}
