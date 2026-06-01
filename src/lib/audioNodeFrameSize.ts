import {
  TEXT_NODE_CHROME_HEIGHT_EMPTY,
  TEXT_NODE_CHROME_WIDTH,
} from "@/lib/textNodeChrome";

/** 与文本节点预览壳默认宽一致 */
export const AUDIO_NODE_WIDTH = TEXT_NODE_CHROME_WIDTH;
/** 与文本节点预览壳默认高一致（16:9 图片预览同高，非宽扁条） */
export const AUDIO_NODE_HEIGHT = TEXT_NODE_CHROME_HEIGHT_EMPTY;

/** 音频节点预览壳尺寸：固定对齐文本节点，不支持用户拖拽改壳。 */
export function computeAudioNodeFrameSize(): { width: number; height: number } {
  return { width: AUDIO_NODE_WIDTH, height: AUDIO_NODE_HEIGHT };
}
