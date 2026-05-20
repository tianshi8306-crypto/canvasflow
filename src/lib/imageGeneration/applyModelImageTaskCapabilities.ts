import type { ImageGenerationContext } from "@/lib/imageGeneration/types";
import { imageTaskStatusLabel } from "@/lib/imageGeneration/detectImageTask";

export type ImageModelCapabilities = {
  /** 为 false 时 multi_ref_fusion 降级为 image_to_image（仅首张参考） */
  supportsMultiRefFusion: boolean;
  /** 参考图上限，1～4 */
  maxReferenceImages: number;
  /** 为 false 时 image_edit 阻断 */
  supportsImageEdit: boolean;
};

export const DEFAULT_IMAGE_MODEL_CAPABILITIES: ImageModelCapabilities = {
  supportsMultiRefFusion: true,
  maxReferenceImages: 4,
  supportsImageEdit: true,
};

export function imageModelCapabilitiesFromConfig(config?: {
  supportsMultiRefFusion?: boolean;
  maxReferenceImages?: number;
  supportsImageEdit?: boolean;
}): ImageModelCapabilities {
  const max = config?.maxReferenceImages ?? DEFAULT_IMAGE_MODEL_CAPABILITIES.maxReferenceImages;
  return {
    supportsMultiRefFusion: config?.supportsMultiRefFusion !== false,
    maxReferenceImages: Math.min(4, Math.max(1, max)),
    supportsImageEdit: config?.supportsImageEdit !== false,
  };
}

function joinWarnings(...parts: Array<string | null | undefined>): string | null {
  const merged = parts.map((p) => p?.trim()).filter((p): p is string => Boolean(p));
  return merged.length > 0 ? merged.join("；") : null;
}

/**
 * 按当前图片模型能力调整 task 与 reference 列表（规格 Phase C）。
 * 拓扑推断结果不变时直接返回原上下文。
 */
export function applyModelImageTaskCapabilities(
  ctx: ImageGenerationContext,
  capabilities: ImageModelCapabilities = DEFAULT_IMAGE_MODEL_CAPABILITIES,
): ImageGenerationContext {
  if (ctx.blockReason || !ctx.task) return ctx;

  const warnings: string[] = [];
  if (ctx.warnMessage) warnings.push(ctx.warnMessage);

  if (ctx.task === "image_edit" && !capabilities.supportsImageEdit) {
    return {
      ...ctx,
      task: null,
      referenceImagePaths: [],
      blockReason: "当前模型不支持图像编辑，请在设置中启用或更换模型。",
      warnMessage: joinWarnings(...warnings),
    };
  }

  let task = ctx.task;
  let referenceImagePaths = [...ctx.referenceImagePaths];
  const maxRefs = capabilities.maxReferenceImages;

  if (referenceImagePaths.length > maxRefs) {
    referenceImagePaths = referenceImagePaths.slice(0, maxRefs);
    warnings.push(`当前模型最多使用 ${maxRefs} 张参考图`);
  }

  if (task === "multi_ref_fusion" && !capabilities.supportsMultiRefFusion) {
    task = "image_to_image";
    if (referenceImagePaths.length > 1) {
      referenceImagePaths = referenceImagePaths.slice(0, 1);
    }
    warnings.push("当前模型不支持多图融合，已改用图生图（仅首张参考）");
  }

  if (
    task === ctx.task &&
    referenceImagePaths.length === ctx.referenceImagePaths.length &&
    referenceImagePaths.every((p, i) => p === ctx.referenceImagePaths[i])
  ) {
    return ctx;
  }

  return {
    ...ctx,
    task,
    referenceImagePaths,
    warnMessage: joinWarnings(...warnings),
  };
}

/** 只读展示用（含模型降级后的任务标签） */
export function effectiveImageTaskStatusLabel(
  ctx: ImageGenerationContext,
  capabilities?: ImageModelCapabilities,
): string | null {
  const effective = applyModelImageTaskCapabilities(ctx, capabilities);
  if (!effective.task) return null;
  return imageTaskStatusLabel(effective.task, effective.referenceImagePaths.length);
}
