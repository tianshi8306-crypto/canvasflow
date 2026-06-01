import type { Edge, Node } from "@xyflow/react";
import {
  applyAnchorMenuGraphFilter,
  isAnchorPartnerOfferedForKind,
} from "@/lib/nodeAnchorMenuAvailability";
import { newNodeDataByType } from "@/lib/canvasNodeDefaults";
import type { FlowNodeData } from "@/lib/types";
import { isConnectionAllowed } from "@/lib/flowConnectionPolicy";

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

/** 锚点菜单 / 手柄提示文案（Simple + Magnetic 统一） */
export const ANCHOR_MENU_TITLE = {
  incoming: "添加上游输入",
  outgoing: "引出输出",
} as const;

export function anchorMenuTitle(side: keyof typeof ANCHOR_MENU_TITLE): string {
  return ANCHOR_MENU_TITLE[side];
}

export function anchorHandleTitle(side: keyof typeof ANCHOR_MENU_TITLE): string {
  return anchorMenuTitle(side);
}

const STANDARD_ROWS: AnchorMenuRow[] = [
  { key: "textNode", label: "文本" },
  { key: "imageNode", label: "图片" },
  { key: "videoNode", label: "视频" },
  { key: "ffmpegConcat", label: "剪辑" },
  { key: "audioNode", label: "音频" },
  { key: "scriptNode", label: "脚本" },
];

/** 主创作链路排序：引入从叙事上游到素材，引出从结构化到合成 */
const INCOMING_KIND_ORDER: CreationKind[] = [
  "textNode",
  "scriptNode",
  "imageNode",
  "videoNode",
  "audioNode",
  "ffmpegConcat",
];

const OUTGOING_KIND_ORDER: CreationKind[] = [
  "scriptNode",
  "imageNode",
  "videoNode",
  "audioNode",
  "ffmpegConcat",
  "textNode",
];

const INCOMING_KIND_ORDER_BY_ANCHOR: Partial<Record<string, CreationKind[]>> = {
  scriptNode: ["textNode", "scriptNode", "imageNode", "videoNode", "audioNode"],
  videoNode: ["imageNode", "videoNode", "audioNode", "textNode", "scriptNode"],
  audioNode: ["textNode", "scriptNode"],
  ffmpegConcat: ["videoNode"],
};

const OUTGOING_KIND_ORDER_BY_ANCHOR: Partial<Record<string, CreationKind[]>> = {
  scriptNode: ["imageNode", "videoNode", "audioNode", "textNode"],
  imageNode: ["videoNode", "textNode", "scriptNode"],
  videoNode: ["ffmpegConcat", "textNode", "scriptNode"],
  audioNode: ["videoNode"],
  textNode: ["scriptNode", "imageNode", "videoNode", "audioNode"],
  mediaImport: ["textNode", "scriptNode"],
};

/** 与 LeftAddDock「创作」列表一致（不含 LLM；LLM 走 extra） */
export function getStandardAnchorRows(): AnchorMenuRow[] {
  return STANDARD_ROWS;
}

function isCreationKind(key: AnchorMenuKey): key is CreationKind {
  return key in newNodeDataByType;
}

export type AnchorMenuGraphContext = {
  anchorNodeId: string;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
};

function isAnchorPartnerOffered(
  anchorType: string,
  direction: "incoming" | "outgoing",
  partnerKey: CreationKind,
): boolean {
  return isAnchorPartnerOfferedForKind(anchorType, direction, partnerKey);
}

function sortAnchorRows(
  rows: AnchorMenuRow[],
  anchorType: string,
  direction: "incoming" | "outgoing",
): AnchorMenuRow[] {
  const order =
    direction === "incoming"
      ? (INCOMING_KIND_ORDER_BY_ANCHOR[anchorType] ?? INCOMING_KIND_ORDER)
      : (OUTGOING_KIND_ORDER_BY_ANCHOR[anchorType] ?? OUTGOING_KIND_ORDER);
  const rank = new Map(order.map((k, i) => [k, i]));
  return [...rows].sort((a, b) => {
    if (!isCreationKind(a.key) || !isCreationKind(b.key)) return 0;
    return (rank.get(a.key) ?? 99) - (rank.get(b.key) ?? 99);
  });
}

function filterCreationRows(
  anchorType: string,
  direction: "incoming" | "outgoing",
): AnchorMenuRow[] {
  return STANDARD_ROWS.filter(
    (row) => isCreationKind(row.key) && isAnchorPartnerOffered(anchorType, direction, row.key),
  );
}

/** 引入（左侧）：合法伙伴 + 工作流排序 */
export function getIncomingAnchorRows(anchorType: string | undefined): AnchorMenuRow[] {
  if (!anchorType) return [];
  return sortAnchorRows(filterCreationRows(anchorType, "incoming"), anchorType, "incoming");
}

/** 引出（右侧）：合法下游 + 工作流排序 */
export function getOutgoingAnchorRows(anchorType: string | undefined): AnchorMenuRow[] {
  if (!anchorType) return [];
  return sortAnchorRows(filterCreationRows(anchorType, "outgoing"), anchorType, "outgoing");
}

export function getIncomingExtraRows(anchorType: string | undefined): AnchorMenuRow[] {
  const extras: AnchorMenuRow[] = [];
  if (anchorType === "videoNode") {
    extras.push(
      { key: "videoFirstLastSetup", label: "首尾帧向导" },
      { key: "videoFirstFrameSetup", label: "首帧生成视频" },
    );
  }
  if (anchorType === "audioNode") {
    extras.push({ key: "audioTts", label: "文字转语音面板" });
  }
  if (anchorType === "imageNode") {
    extras.push({ key: "imageI2iImport", label: "图生图" });
  }
  if (anchorType === "scriptNode" && isConnectionAllowed("llm", "scriptNode")) {
    extras.push({ key: "llm", label: "LLM" });
  }
  return extras;
}

/** 引入菜单完整列表（extra 置顶；ctx 可选，用于 P3 图状态过滤） */
export function getIncomingMenuRows(
  anchorType: string | undefined,
  ctx?: AnchorMenuGraphContext,
): AnchorMenuRow[] {
  const rows = [...getIncomingExtraRows(anchorType), ...getIncomingAnchorRows(anchorType)];
  return applyAnchorMenuGraphFilter(rows, anchorType, "incoming", ctx);
}

/** 引出菜单完整列表 */
export function getOutgoingMenuRows(
  anchorType: string | undefined,
  ctx?: AnchorMenuGraphContext,
): AnchorMenuRow[] {
  const rows = getOutgoingAnchorRows(anchorType);
  return applyAnchorMenuGraphFilter(rows, anchorType, "outgoing", ctx);
}
