import {
  TEXT_NODE_CHROME_HEIGHT_EMPTY,
  TEXT_NODE_CHROME_WIDTH,
  computeTextNodeFrameSize,
} from "@/lib/textNodeChrome";

/** 与文本预览壳同宽（图片 500 × 0.6） */
export const AUDIO_NODE_WIDTH = TEXT_NODE_CHROME_WIDTH;
/** 与文本预览壳同高（16:9 画幅） */
export const AUDIO_NODE_HEIGHT = TEXT_NODE_CHROME_HEIGHT_EMPTY;

/**
 * 音频节点预览壳尺寸：真源与 `computeTextNodeFrameSize` 一致，
 * 上/下 Portal 宽度均绑定返回值。
 */
export function computeAudioNodeFrameSize(opts?: {
  chromeWidth?: number;
  chromeHeight?: number;
}): { width: number; height: number } {
  return computeTextNodeFrameSize({
    hasBody: false,
    chromeWidth: opts?.chromeWidth,
    chromeHeight: opts?.chromeHeight,
  });
}
