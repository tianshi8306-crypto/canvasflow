import {
  IMAGE_ASPECT_OPTIONS,
  IMAGE_RESOLUTION_TIERS,
  type ImageAspectId,
  type ImageResolutionTierId,
} from "@/lib/imageGeneration/catalog";

import {
  CANVAS_MEDIA_NODE_MAX_EDGE,
  CANVAS_MEDIA_NODE_MIN_EDGE,
  computeCanvasMediaNodeFrameSize,
} from "@/lib/canvasMediaNodeFrame";

export const IMAGE_NODE_MAX_EDGE = CANVAS_MEDIA_NODE_MAX_EDGE;
export const IMAGE_NODE_MIN_EDGE = CANVAS_MEDIA_NODE_MIN_EDGE;

export function getAspectRatioNumber(aspectId: ImageAspectId): number {
  if (aspectId === "auto") return 16 / 9;
  const opt = IMAGE_ASPECT_OPTIONS.find((a) => a.id === aspectId);
  if (!opt) return 16 / 9;
  return opt.ratioW / opt.ratioH;
}

export function inferAspectIdFromDimensions(
  width: number,
  height: number,
): ImageAspectId {
  if (width <= 0 || height <= 0) return "16:9";
  const ratio = width / height;
  let best: ImageAspectId = "16:9";
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const opt of IMAGE_ASPECT_OPTIONS) {
    if (opt.id === "auto") continue;
    const r = opt.ratioW / opt.ratioH;
    const diff = Math.abs(Math.log(ratio) - Math.log(r));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = opt.id;
    }
  }
  return best;
}

export function resolveEffectiveAspectId(
  aspectId: ImageAspectId,
  imageWidth?: number,
  imageHeight?: number,
): ImageAspectId {
  if (aspectId !== "auto") return aspectId;
  if (imageWidth && imageHeight && imageWidth > 0 && imageHeight > 0) {
    return inferAspectIdFromDimensions(imageWidth, imageHeight);
  }
  return "16:9";
}

export function resolveImageApiSize(
  aspectId: ImageAspectId,
  resolutionTier: ImageResolutionTierId,
  imageWidth?: number,
  imageHeight?: number,
): string {
  const effective = resolveEffectiveAspectId(aspectId, imageWidth, imageHeight);
  const tier = IMAGE_RESOLUTION_TIERS.find((t) => t.id === resolutionTier) ?? IMAGE_RESOLUTION_TIERS[1];
  const shortEdge = tier.shortEdge;

  if (effective === "1:1") {
    return `${shortEdge}x${shortEdge}`;
  }

  const opt = IMAGE_ASPECT_OPTIONS.find((a) => a.id === effective)!;
  const ratio = opt.ratioW / opt.ratioH;
  if (ratio >= 1) {
    const h = shortEdge;
    const w = Math.round(h * ratio);
    return `${w}x${h}`;
  }
  const w = shortEdge;
  const h = Math.round(w / ratio);
  return `${w}x${h}`;
}

export function parseApiSizeLabel(size: string): { width: number; height: number } | null {
  const m = /^(\d+)x(\d+)$/i.exec(size.trim());
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (!width || !height) return null;
  return { width, height };
}

/** 画布预览框尺寸：长边不超过 maxEdge，比例与成片一致 */
export function computeImageNodeFrameSize(
  ratio: number,
  maxEdge = IMAGE_NODE_MAX_EDGE,
): { width: number; height: number } {
  return computeCanvasMediaNodeFrameSize(ratio, maxEdge);
}

export function resolveImageNodeFrameRatio(opts: {
  aspectId: ImageAspectId;
  imageWidth?: number;
  imageHeight?: number;
}): number {
  if (opts.imageWidth && opts.imageHeight && opts.imageWidth > 0 && opts.imageHeight > 0) {
    return opts.imageWidth / opts.imageHeight;
  }
  return getAspectRatioNumber(resolveEffectiveAspectId(opts.aspectId, opts.imageWidth, opts.imageHeight));
}
