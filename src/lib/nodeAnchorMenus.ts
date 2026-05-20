import { newNodeDataByType } from "@/lib/canvasNodeDefaults";

export type CreationKind = keyof typeof newNodeDataByType;

export type AnchorMenuKey =
  | CreationKind
  | "videoFirstLastSetup"
  | "videoFirstFrameSetup"
  | "audioTts"
  | "imageI2iImport";

export type AnchorMenuRow = {
  key: AnchorMenuKey;
  label: string;
};

const STANDARD_ROWS: AnchorMenuRow[] = [
  { key: "textNode", label: "文本" },
  { key: "imageNode", label: "图片" },
  { key: "videoNode", label: "视频" },
  { key: "ffmpegConcat", label: "视频合成" },
  { key: "audioNode", label: "音频" },
  { key: "scriptNode", label: "脚本" },
];

/** 与 LeftAddDock「创作」列表一致，所有支持创建的节点类型 */
export function getStandardAnchorRows(): AnchorMenuRow[] {
  return STANDARD_ROWS;
}

export function getIncomingExtraRows(anchorType: string | undefined): AnchorMenuRow[] {
  if (anchorType === "videoNode") {
    return [
      { key: "videoFirstLastSetup", label: "首尾帧向导" },
      { key: "videoFirstFrameSetup", label: "首帧生成视频" },
    ];
  }
  if (anchorType === "audioNode") {
    return [{ key: "audioTts", label: "文字转语音面板" }];
  }
  if (anchorType === "imageNode") {
    return [{ key: "imageI2iImport", label: "图生图" }];
  }
  return [];
}
