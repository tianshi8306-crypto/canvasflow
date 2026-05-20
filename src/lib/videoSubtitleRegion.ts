import type { VideoSubtitleRegion } from "@/lib/videoNodeTypes";

const MIN_W = 0.05;
const MIN_H = 0.03;

/** 常见底部硬字幕默认框：宽 90% 居中，高约 14% */
export function defaultVideoSubtitleRegion(): VideoSubtitleRegion {
  return { x: 0.05, y: 0.82, w: 0.9, h: 0.14 };
}

export function normalizeVideoSubtitleRegion(region: VideoSubtitleRegion): VideoSubtitleRegion {
  let w = Math.max(MIN_W, Math.min(1, region.w));
  let h = Math.max(MIN_H, Math.min(1, region.h));
  let x = Math.max(0, Math.min(1 - w, region.x));
  let y = Math.max(0, Math.min(1 - h, region.y));
  if (x + w > 1) w = 1 - x;
  if (y + h > 1) h = 1 - y;
  return { x, y, w, h };
}
