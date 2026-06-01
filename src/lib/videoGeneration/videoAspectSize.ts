import {
  TEXT_TO_VIDEO_ASPECT_IDS,
  type TextToVideoAspectId,
} from "@/lib/videoNodeTypes";

import {
  CANVAS_MEDIA_NODE_MAX_EDGE,
  CANVAS_MEDIA_NODE_MIN_EDGE,
  computeCanvasMediaNodeFrameSize,
} from "@/lib/canvasMediaNodeFrame";

export const VIDEO_NODE_MAX_EDGE = CANVAS_MEDIA_NODE_MAX_EDGE;
export const VIDEO_NODE_MIN_EDGE = CANVAS_MEDIA_NODE_MIN_EDGE;

const ASPECT_RATIO: Record<TextToVideoAspectId, number> = {
  auto: 16 / 9,
  "16:9": 16 / 9,
  "4:3": 4 / 3,
  "1:1": 1,
  "3:4": 3 / 4,
  "9:16": 9 / 16,
  "21:9": 21 / 9,
};

export function getVideoAspectRatioNumber(aspectId: TextToVideoAspectId): number {
  return ASPECT_RATIO[aspectId] ?? 16 / 9;
}

export function inferVideoAspectIdFromDimensions(
  width: number,
  height: number,
): TextToVideoAspectId {
  if (width <= 0 || height <= 0) return "16:9";
  const ratio = width / height;
  let best: TextToVideoAspectId = "16:9";
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const id of TEXT_TO_VIDEO_ASPECT_IDS) {
    if (id === "auto") continue;
    const r = ASPECT_RATIO[id];
    const diff = Math.abs(Math.log(ratio) - Math.log(r));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = id;
    }
  }
  return best;
}

export function resolveVideoNodeFrameRatio(opts: {
  aspectId: TextToVideoAspectId;
  videoWidth?: number;
  videoHeight?: number;
}): number {
  if (opts.videoWidth && opts.videoHeight && opts.videoWidth > 0 && opts.videoHeight > 0) {
    return opts.videoWidth / opts.videoHeight;
  }
  const id = opts.aspectId === "auto" ? "16:9" : opts.aspectId;
  return getVideoAspectRatioNumber(id);
}

/** Canvas preview frame: long edge capped, matches output aspect */
export function computeVideoNodeFrameSize(
  ratio: number,
  maxEdge = VIDEO_NODE_MAX_EDGE,
): { width: number; height: number } {
  return computeCanvasMediaNodeFrameSize(ratio, maxEdge);
}
