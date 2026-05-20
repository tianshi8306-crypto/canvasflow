import type { VideoSubtitleRegion } from "@/lib/videoNodeTypes";

export type PxRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** object-fit: contain 时，视频在容器内的实际绘制区域 */
export function getVideoContentRect(
  containerWidth: number,
  containerHeight: number,
  intrinsicWidth: number,
  intrinsicHeight: number,
): PxRect {
  if (
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    intrinsicWidth <= 0 ||
    intrinsicHeight <= 0
  ) {
    return { left: 0, top: 0, width: Math.max(0, containerWidth), height: Math.max(0, containerHeight) };
  }
  const scale = Math.min(containerWidth / intrinsicWidth, containerHeight / intrinsicHeight);
  const width = intrinsicWidth * scale;
  const height = intrinsicHeight * scale;
  return {
    left: (containerWidth - width) / 2,
    top: (containerHeight - height) / 2,
    width,
    height,
  };
}

export function normalizedRegionToContentPx(
  region: VideoSubtitleRegion,
  content: PxRect,
): PxRect {
  return {
    left: content.left + region.x * content.width,
    top: content.top + region.y * content.height,
    width: region.w * content.width,
    height: region.h * content.height,
  };
}

/** 归一化区域 → 编码像素（供 FFmpeg delogo） */
export function normalizedRegionToPixels(
  region: VideoSubtitleRegion,
  intrinsicWidth: number,
  intrinsicHeight: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.round(region.x * intrinsicWidth),
    y: Math.round(region.y * intrinsicHeight),
    w: Math.round(region.w * intrinsicWidth),
    h: Math.round(region.h * intrinsicHeight),
  };
}

export function contentPxToNormalizedRegion(box: PxRect, content: PxRect): VideoSubtitleRegion {
  if (content.width <= 0 || content.height <= 0) {
    return { x: 0, y: 0, w: 1, h: 0.14 };
  }
  return {
    x: (box.left - content.left) / content.width,
    y: (box.top - content.top) / content.height,
    w: box.width / content.width,
    h: box.height / content.height,
  };
}

/** 指针是否在 letterbox 内的视频画面上 */
export function clientPointInVideoContent(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  intrinsicWidth: number,
  intrinsicHeight: number,
): boolean {
  const localX = clientX - containerRect.left;
  const localY = clientY - containerRect.top;
  const content = getVideoContentRect(
    containerRect.width,
    containerRect.height,
    intrinsicWidth,
    intrinsicHeight,
  );
  return (
    localX >= content.left &&
    localX <= content.left + content.width &&
    localY >= content.top &&
    localY <= content.top + content.height
  );
}
