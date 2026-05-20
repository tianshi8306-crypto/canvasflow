import type { ImageAspectId } from "@/lib/imageGeneration/catalog";
import {
  computeImageNodeFrameSize,
  getAspectRatioNumber,
  IMAGE_NODE_MAX_EDGE,
  IMAGE_NODE_MIN_EDGE,
} from "@/lib/imageGeneration/imageAspectSize";

/** 文本预览壳宽度 = 图片预览壳宽度 × 该比例 */
export const TEXT_NODE_PREVIEW_WIDTH_RATIO = 0.6;

/** 与图片节点空态默认画幅一致（16:9，长边 500） */
export const TEXT_NODE_DEFAULT_IMAGE_ASPECT: ImageAspectId = "16:9";

function defaultImagePreviewFrame(maxEdge = IMAGE_NODE_MAX_EDGE) {
  const ratio = getAspectRatioNumber(TEXT_NODE_DEFAULT_IMAGE_ASPECT);
  return computeImageNodeFrameSize(ratio, maxEdge);
}

function textPreviewSizeFromImageFrame(imageFrame: { width: number; height: number }) {
  return {
    width: Math.max(
      1,
      Math.round(imageFrame.width * TEXT_NODE_PREVIEW_WIDTH_RATIO),
    ),
    height: imageFrame.height,
  };
}

const _imagePreviewDefault = defaultImagePreviewFrame();
const _textPreviewDefault = textPreviewSizeFromImageFrame(_imagePreviewDefault);
const _imagePreviewMin = defaultImagePreviewFrame(IMAGE_NODE_MIN_EDGE);
/** 用户拖拽放大时的长边上限（默认壳对齐图片 500；可拉大到更大阅读区） */
export const TEXT_NODE_CHROME_RESIZE_MAX_EDGE = 1400;

const _textPreviewResizeMax = textPreviewSizeFromImageFrame(
  defaultImagePreviewFrame(TEXT_NODE_CHROME_RESIZE_MAX_EDGE),
);

/** 文本预览壳默认宽（图片 500 × 0.6） */
export const TEXT_NODE_CHROME_WIDTH = _textPreviewDefault.width;
/** 文本预览壳默认高（与图片预览壳同高） */
export const TEXT_NODE_CHROME_HEIGHT_EMPTY = _textPreviewDefault.height;
/** 有正文时仍保持与图片预览同高（完整编辑在双击 / Modal） */
export const TEXT_NODE_CHROME_HEIGHT_BODY = _textPreviewDefault.height;

export const TEXT_NODE_CHROME_MIN_WIDTH = Math.max(
  48,
  Math.round(_imagePreviewMin.width * TEXT_NODE_PREVIEW_WIDTH_RATIO),
);
export const TEXT_NODE_CHROME_MAX_WIDTH = _textPreviewResizeMax.width;
export const TEXT_NODE_CHROME_MIN_HEIGHT = _imagePreviewMin.height;
export const TEXT_NODE_CHROME_MAX_HEIGHT = _textPreviewResizeMax.height;

/** 只读摘要最大行数（壳内不撑满全文） */
export const TEXT_NODE_READONLY_MAX_LINES = 10;

export function computeTextNodeFrameSize(opts: {
  hasBody: boolean;
  /** 用户拖拽后的壳尺寸（持久化在 params） */
  chromeWidth?: number;
  chromeHeight?: number;
  /** 正文行数（保留入参；高度已与图片预览对齐，不再按行数撑高） */
  bodyLineCount?: number;
}): { width: number; height: number } {
  void opts.hasBody;
  void opts.bodyLineCount;

  if (
    typeof opts.chromeWidth === "number" &&
    typeof opts.chromeHeight === "number" &&
    opts.chromeWidth > 0 &&
    opts.chromeHeight > 0
  ) {
    return {
      width: Math.min(
        TEXT_NODE_CHROME_MAX_WIDTH,
        Math.max(TEXT_NODE_CHROME_MIN_WIDTH, opts.chromeWidth),
      ),
      height: Math.min(
        TEXT_NODE_CHROME_MAX_HEIGHT,
        Math.max(TEXT_NODE_CHROME_MIN_HEIGHT, opts.chromeHeight),
      ),
    };
  }

  return textPreviewSizeFromImageFrame(_imagePreviewDefault);
}
