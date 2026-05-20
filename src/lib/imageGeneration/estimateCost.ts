import type { ImageTaskMode } from "@/lib/imageGeneration/catalog";

/** 本地估算占位（非计费真源）；用于浮层底栏「算力可见」 */
export function estimateImageGenerationCost(params: {
  count: number;
  resolutionId: string;
  task: ImageTaskMode | null;
}): string {
  const tier = params.resolutionId.toUpperCase();
  const perUnit = tier === "4K" ? 0.12 : tier === "1K" ? 0.03 : 0.06;
  let mult = 1;
  if (params.task === "multi_ref_fusion") mult = 1.5;
  if (params.task === "image_to_image") mult = 1.1;
  const total = perUnit * Math.max(1, params.count) * mult;
  return `约 ¥${total.toFixed(2)}`;
}
