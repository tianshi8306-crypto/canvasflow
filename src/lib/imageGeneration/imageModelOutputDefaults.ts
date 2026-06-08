import type { ImageModelOption } from "@/hooks/useImageModels";
import type { ImageAspectId, ImageResolutionTierId } from "@/lib/imageGeneration/catalog";

/** 按模型/API 标识推断默认输出（后续可接各厂商能力表） */
export function pickDefaultOutputForImageModel(
  model?: Pick<ImageModelOption, "model" | "label"> | null,
): { aspect: ImageAspectId; resolution: ImageResolutionTierId } {
  const key = `${model?.model ?? ""} ${model?.label ?? ""}`.toLowerCase();
  if (key.includes("4k") || key.includes("ultra")) {
    return { aspect: "16:9", resolution: "4K" };
  }
  if (key.includes("lite") || key.includes("nano") || key.includes("fast")) {
    return { aspect: "16:9", resolution: "1K" };
  }
  if (key.includes("gpt-image")) {
    return { aspect: "1:1", resolution: "2K" };
  }
  return { aspect: "16:9", resolution: "2K" };
}
