import { useMemo } from "react";
import { useProjectStore } from "@/store/projectStore";
import {
  VIDEO_REFERENCE_AUDIO,
  VIDEO_REFERENCE_IMAGE,
  VIDEO_REFERENCE_VIDEO,
} from "@/lib/videoInputConstraints";
import { isEdgeDisabled } from "@/lib/edgeState";
import { audioContentFromUpstreamNode, textContentFromUpstreamNode } from "@/lib/incomingScriptBinding";
import { resolveAssetRelPath } from "@/shared/api/assets";
import type { FlowNodeData } from "@/lib/types";
import type { Edge, Node } from "@xyflow/react";
import type { VideoGenerationWorkflow } from "@/lib/videoNodeTypes";

export type VideoIncomingRefKind = "image" | "video" | "audio" | "text";

export type VideoIncomingRefItem = {
  kind: VideoIncomingRefKind;
  /** 工程相对路径；文本类上游可为空 */
  path: string;
  assetId?: string;
  /** 自上而下排序用 */
  y: number;
  /** 对应的连线 ID（用于删除） */
  edgeId: string;
  sourceNodeId: string;
  /** 源节点标签（参考条与 @节点名） */
  nodeLabel: string;
  /** 文本类上游正文预览（LibTV 悬停气泡） */
  textContent?: string;
  /** 音频上游含 TTS/台词文案（LibTV 右上角引号角标） */
  hasAudioDialogue?: boolean;
};

const TEXT_UPSTREAM_TYPES = new Set<Node<FlowNodeData>["type"]>(["textNode", "llm"]);

function defaultNodeLabel(type: string | undefined): string {
  if (type === "llm") return "LLM 节点";
  if (type === "textNode") return "文本节点";
  if (type === "videoNode") return "视频节点";
  if (type === "audioNode") return "音频节点";
  if (type === "imageNode") return "图片节点";
  return "节点";
}

/** 将连线上的 path/assetId 解析为可用于草稿/API 的 `path`（优先 assetId）；无路径项跳过。 */
export async function resolveIncomingRefItemsForDraft(
  projectPath: string | null | undefined,
  items: VideoIncomingRefItem[],
): Promise<VideoIncomingRefItem[]> {
  const out: VideoIncomingRefItem[] = [];
  for (const it of items) {
    if (!it.path?.trim() && !it.assetId?.trim()) continue;
    const p = await resolveAssetRelPath(projectPath, it.path, it.assetId);
    if (p) out.push({ ...it, path: p });
  }
  return out;
}

/**
 * 连入当前视频节点的上游参考（图/视/音/文本，按源节点 Y 排序）。
 * 与 Seedance 参考条一致：有媒体则写入 reference*Paths；文本类以节点标签展示并参与 @ 解析。
 */
export function collectVideoIncomingRefItems(
  videoNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): VideoIncomingRefItem[] {
  const incoming = edges.filter(
    (e) =>
      !isEdgeDisabled(e) &&
      e.target === videoNodeId &&
      (!e.targetHandle || e.targetHandle === "in"),
  );
  const sourceIds = [...new Set(incoming.map((e) => e.source))];
  const items: VideoIncomingRefItem[] = [];

  for (const sid of sourceIds) {
    if (sid === videoNodeId) continue;
    const n = nodes.find((x) => x.id === sid);
    if (!n?.type) continue;
    const edge = incoming.find((e) => e.source === sid);
    const eid = edge?.id ?? "";
    const p = n.data.path?.trim() ?? "";
    const aid = n.data.assetId?.trim();
    const label = n.data.label?.trim() || defaultNodeLabel(n.type);
    const base = { y: n.position.y, edgeId: eid, sourceNodeId: sid, nodeLabel: label };

    if (n.type === "imageNode") {
      items.push({ kind: "image", path: p, assetId: aid, ...base });
    } else if (n.type === "videoNode") {
      items.push({ kind: "video", path: p, assetId: aid, ...base });
    } else if (n.type === "audioNode") {
      const tts = audioContentFromUpstreamNode(n.data);
      items.push({
        kind: "audio",
        path: p,
        assetId: aid,
        ...base,
        hasAudioDialogue: Boolean(tts),
      });
    } else if (n.type && TEXT_UPSTREAM_TYPES.has(n.type)) {
      items.push({
        kind: "text",
        path: "",
        ...base,
        textContent: textContentFromUpstreamNode(n.data),
      });
    }
  }

  items.sort((a, b) => a.y - b.y);
  return items;
}

export function useVideoIncomingReferenceItems(videoNodeId: string | undefined): VideoIncomingRefItem[] {
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);

  return useMemo(() => {
    if (!videoNodeId) return [];
    return collectVideoIncomingRefItems(videoNodeId, nodes, edges);
  }, [nodes, edges, videoNodeId]);
}

/** 读取 draft.referenceEdgeOrder 后的连线参考顺序（生成与 @ 解析共用） */
export function resolveOrderedVideoIncomingRefItems(
  videoNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): VideoIncomingRefItem[] {
  const raw = collectVideoIncomingRefItems(videoNodeId, nodes, edges);
  const node = nodes.find((n) => n.id === videoNodeId);
  const edgeOrder = node?.data.video?.draft.referenceEdgeOrder;
  return applyIncomingRefEdgeOrder(raw, syncReferenceEdgeOrder(edgeOrder, raw));
}

/** 仅有媒体路径的项写入 draft.reference*Paths（文本类走 prompt，不占文件槽）。 */
export function splitIncomingRefsForDraft(items: VideoIncomingRefItem[]): {
  referenceImagePaths: string[];
  referenceVideoPaths: string[];
  referenceAudioPaths: string[];
} {
  const referenceImagePaths = items
    .filter((i) => i.kind === "image" && i.path?.trim())
    .map((i) => i.path)
    .slice(0, VIDEO_REFERENCE_IMAGE.maxCount);
  const referenceVideoPaths = items
    .filter((i) => i.kind === "video" && i.path?.trim())
    .map((i) => i.path)
    .slice(0, VIDEO_REFERENCE_VIDEO.maxCount);
  const referenceAudioPaths = items
    .filter((i) => i.kind === "audio" && i.path?.trim())
    .map((i) => i.path)
    .slice(0, VIDEO_REFERENCE_AUDIO.maxCount);
  return { referenceImagePaths, referenceVideoPaths, referenceAudioPaths };
}

/**
 * 缩略条展示顺序：自上而下遍历，各媒体类型分别计数不超过 Seedance 上限；文本上游全部展示。
 */
export function incomingRefsForDisplayStrip(items: VideoIncomingRefItem[]): VideoIncomingRefItem[] {
  let ic = 0;
  let vc = 0;
  let ac = 0;
  const out: VideoIncomingRefItem[] = [];
  for (const it of items) {
    if (it.kind === "text") {
      out.push(it);
    } else if (it.kind === "image" && ic < VIDEO_REFERENCE_IMAGE.maxCount) {
      out.push(it);
      ic++;
    } else if (it.kind === "video" && vc < VIDEO_REFERENCE_VIDEO.maxCount) {
      out.push(it);
      vc++;
    } else if (it.kind === "audio" && ac < VIDEO_REFERENCE_AUDIO.maxCount) {
      out.push(it);
      ac++;
    }
  }
  return out;
}

/** 将持久化的 edge 顺序应用到连线参考列表（未知 edge 追加在末尾） */
export function applyIncomingRefEdgeOrder(
  items: VideoIncomingRefItem[],
  edgeOrder?: string[],
): VideoIncomingRefItem[] {
  if (!edgeOrder?.length) return items;
  const byEdge = new Map(items.map((i) => [i.edgeId, i]));
  const out: VideoIncomingRefItem[] = [];
  const seen = new Set<string>();
  for (const eid of edgeOrder) {
    const it = byEdge.get(eid);
    if (!it) continue;
    out.push(it);
    seen.add(eid);
  }
  for (const it of items) {
    if (!seen.has(it.edgeId)) out.push(it);
  }
  return out;
}

/** 连线增删后合并 referenceEdgeOrder：保留已有顺序，新连线追加在末尾 */
export function syncReferenceEdgeOrder(
  saved: string[] | undefined,
  items: VideoIncomingRefItem[],
): string[] {
  const ids = items.map((i) => i.edgeId);
  const idSet = new Set(ids);
  const kept = (saved ?? []).filter((id) => idSet.has(id));
  const keptSet = new Set(kept);
  for (const id of ids) {
    if (!keptSet.has(id)) kept.push(id);
  }
  return kept;
}

/** 在参考条可见项内拖动换位，返回新的完整 edge 顺序 */
export function reorderIncomingRefEdgeOrder(
  items: VideoIncomingRefItem[],
  edgeOrder: string[] | undefined,
  displayEdgeIds: string[],
  fromEdgeId: string,
  toEdgeId: string,
): string[] {
  if (fromEdgeId === toEdgeId) return syncReferenceEdgeOrder(edgeOrder, items);
  const order = syncReferenceEdgeOrder(edgeOrder, items);
  const ordered = applyIncomingRefEdgeOrder(items, order);
  const stripSet = new Set(displayEdgeIds);
  const stripItems = ordered.filter((i) => stripSet.has(i.edgeId));
  const tailItems = ordered.filter((i) => !stripSet.has(i.edgeId));
  const fromIdx = stripItems.findIndex((i) => i.edgeId === fromEdgeId);
  const toIdx = stripItems.findIndex((i) => i.edgeId === toEdgeId);
  if (fromIdx < 0 || toIdx < 0) return order;
  const nextStrip = [...stripItems];
  const [moved] = nextStrip.splice(fromIdx, 1);
  nextStrip.splice(toIdx, 0, moved);
  return [...nextStrip.map((i) => i.edgeId), ...tailItems.map((i) => i.edgeId)];
}

/** 交换首尾帧模式下的前两张图片在 edge 顺序中的位置 */
export function swapFirstLastIncomingRefEdgeOrder(
  items: VideoIncomingRefItem[],
  edgeOrder: string[] | undefined,
): string[] {
  const order = syncReferenceEdgeOrder(edgeOrder, items);
  const ordered = applyIncomingRefEdgeOrder(items, order);
  const images = ordered.filter((i) => i.kind === "image" && i.path?.trim()).slice(0, 2);
  if (images.length < 2) return order;
  const id0 = images[0].edgeId;
  const id1 = images[1].edgeId;
  const i0 = order.indexOf(id0);
  const i1 = order.indexOf(id1);
  if (i0 < 0 || i1 < 0) return order;
  const next = [...order];
  next[i0] = id1;
  next[i1] = id0;
  return next;
}

/**
 * 根据连线输入自动检测当前应亮起的 workflow 状态。
 *
 * 规则（与面板 Tab 对齐）：
 * - 有参考视频 → video_reference
 * - 有音频 → multimodal_reference
 * - 2 张图片（无音视频） → first_last_frame
 * - 3+ 张图片 → image_reference
 * - 1 张图片 → image_to_video
 * - 无连线但有文字 → text_to_video
 * - 无任何有效输入 → null
 */
export function detectWorkflow(
  items: VideoIncomingRefItem[],
  promptText: string,
): VideoGenerationWorkflow | null {
  const hasVideo = items.some((i) => i.kind === "video" && i.path?.trim());
  const hasAudio = items.some((i) => i.kind === "audio" && i.path?.trim());
  const imageCount = items.filter((i) => i.kind === "image" && i.path?.trim()).length;
  const hasPrompt = promptText.trim().length > 0;
  const hasTextUpstream = items.some((i) => i.kind === "text");

  if (hasVideo) return "video_reference";
  if (hasAudio) return "multimodal_reference";
  if (imageCount === 2) return "first_last_frame";
  if (imageCount >= 3) return "image_reference";
  if (imageCount === 1) return "image_to_video";
  if (hasPrompt || hasTextUpstream) return "text_to_video";

  return null;
}

/** 各状态的中文标签 */
export const WORKFLOW_STATUS_LABELS: Record<NonNullable<VideoGenerationWorkflow>, string> = {
  text_to_video: "文生视频",
  multimodal_reference: "全能参考",
  image_to_video: "图生视频",
  first_last_frame: "首尾帧",
  image_reference: "图片参考",
  video_reference: "参考视频",
  video_edit: "视频编辑",
  video_extend: "视频延伸",
};
