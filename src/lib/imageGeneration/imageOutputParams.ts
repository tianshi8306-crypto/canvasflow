import type { ImageAspectId, ImageResolutionTierId } from "@/lib/imageGeneration/catalog";

export const IMAGE_OUTPUT_PARAM_ASPECT = "imageAspect";
export const IMAGE_OUTPUT_PARAM_RESOLUTION = "imageResolution";

export type ImageOutputParams = {
  aspect: ImageAspectId;
  resolution: ImageResolutionTierId;
};

export function normalizeImageResolutionId(raw: unknown): ImageResolutionTierId {
  if (raw === "1K" || raw === "2K" || raw === "4K") return raw;
  if (typeof raw === "string") {
    if (raw.includes("4096") || raw.includes("2048")) return "4K";
    if (raw.includes("1024")) return "2K";
  }
  return "2K";
}

export function normalizeImageAspectId(raw: unknown): ImageAspectId {
  const valid = [
    "auto",
    "16:9",
    "4:3",
    "1:1",
    "3:4",
    "9:16",
    "3:2",
    "2:3",
    "4:5",
    "5:4",
    "21:9",
  ] as const;
  if (typeof raw === "string" && (valid as readonly string[]).includes(raw)) {
    return raw as ImageAspectId;
  }
  return "16:9";
}

export function readImageOutputParams(
  params?: Record<string, unknown>,
): ImageOutputParams {
  return {
    aspect: normalizeImageAspectId(params?.[IMAGE_OUTPUT_PARAM_ASPECT]),
    resolution: normalizeImageResolutionId(params?.[IMAGE_OUTPUT_PARAM_RESOLUTION]),
  };
}

export function patchImageOutputParams(
  prev: Record<string, unknown> | undefined,
  patch: Partial<ImageOutputParams>,
): Record<string, unknown> {
  const base = prev && typeof prev === "object" && !Array.isArray(prev) ? { ...prev } : {};
  if (patch.aspect !== undefined) {
    base[IMAGE_OUTPUT_PARAM_ASPECT] = patch.aspect;
  }
  if (patch.resolution !== undefined) {
    base[IMAGE_OUTPUT_PARAM_RESOLUTION] = patch.resolution;
  }
  return base;
}
