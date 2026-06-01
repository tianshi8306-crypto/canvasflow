/** 参考条悬停大图最长边（角色表等多宫格图需更大才能看清全貌） */
export const REF_HOVER_PREVIEW_MAX_PX = 360;

/** 悬停/Focus 大图：按素材原始比例缩放，最长边不超过 maxPx */
export function fitHoverPreviewBox(
  naturalW: number,
  naturalH: number,
  maxPx = REF_HOVER_PREVIEW_MAX_PX,
): { width: number; height: number } {
  if (naturalW <= 0 || naturalH <= 0) {
    return { width: 200, height: 150 };
  }
  const scale = Math.min(1, maxPx / naturalW, maxPx / naturalH);
  return {
    width: Math.max(64, Math.round(naturalW * scale)),
    height: Math.max(64, Math.round(naturalH * scale)),
  };
}

export function readMediaNaturalSize(
  el: HTMLImageElement | HTMLVideoElement,
): { w: number; h: number } | null {
  if (el instanceof HTMLImageElement) {
    const w = el.naturalWidth;
    const h = el.naturalHeight;
    return w > 0 && h > 0 ? { w, h } : null;
  }
  const w = el.videoWidth;
  const h = el.videoHeight;
  return w > 0 && h > 0 ? { w, h } : null;
}

export const REF_HOVER_PREVIEW_DELAY_MS = 180;
