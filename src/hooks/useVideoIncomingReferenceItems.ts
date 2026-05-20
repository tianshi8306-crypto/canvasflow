import { useMemo } from "react";
import { useProjectStore } from "@/store/projectStore";
import {
  VIDEO_REFERENCE_AUDIO,
  VIDEO_REFERENCE_IMAGE,
  VIDEO_REFERENCE_VIDEO,
} from "@/lib/videoInputConstraints";
import { isEdgeDisabled } from "@/lib/edgeState";
import { resolveAssetRelPath } from "@/shared/api/assets";
import type { VideoGenerationWorkflow } from "@/lib/videoNodeTypes";

export type VideoIncomingRefKind = "image" | "video" | "audio";

export type VideoIncomingRefItem = {
  kind: VideoIncomingRefKind;
  /** 工程相对路径；可与 `assetId` 同时存在，预览优先 id */
  path: string;
  assetId?: string;
  /** 自上而下排序用 */
  y: number;
  /** 对应的连线 ID（用于删除） */
  edgeId: string;
};

/** 将连线上的 path/assetId 解析为可用于草稿/API 的 `path`（优先 assetId） */
export async function resolveIncomingRefItemsForDraft(
  projectPath: string | null | undefined,
  items: VideoIncomingRefItem[],
): Promise<VideoIncomingRefItem[]> {
  const out: VideoIncomingRefItem[] = [];
  for (const it of items) {
    const p = await resolveAssetRelPath(projectPath, it.path, it.assetId);
    if (p) out.push({ ...it, path: p });
  }
  return out;
}

/**
 * 连入当前视频节点的图片 / 视频成片 / 音频（按源节点 Y 排序）。
 * 用于缩略条展示与写入 draft.reference*Paths。
 */
export function useVideoIncomingReferenceItems(videoNodeId: string | undefined): VideoIncomingRefItem[] {
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);

  return useMemo(() => {
    if (!videoNodeId) return [];
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
      if (!n) continue;
      const p = n.data.path?.trim();
      const aid = n.data.assetId?.trim();
      if (!p && !aid) continue;
      // 找到连接 source -> target 的第一条有效连线
      const edge = incoming.find((e) => e.source === sid);
      const eid = edge?.id ?? "";
      if (n.type === "imageNode") {
        items.push({ kind: "image", path: p ?? "", assetId: aid, y: n.position.y, edgeId: eid });
      } else if (n.type === "videoNode") {
        items.push({ kind: "video", path: p ?? "", assetId: aid, y: n.position.y, edgeId: eid });
      } else if (n.type === "audioNode") {
        items.push({ kind: "audio", path: p ?? "", assetId: aid, y: n.position.y, edgeId: eid });
      }
    }

    items.sort((a, b) => a.y - b.y);
    return items;
  }, [nodes, edges, videoNodeId]);
}

/** 按产品上限拆成三份路径，供生成草稿同步 */
export function splitIncomingRefsForDraft(items: VideoIncomingRefItem[]): {
  referenceImagePaths: string[];
  referenceVideoPaths: string[];
  referenceAudioPaths: string[];
} {
  const referenceImagePaths = items
    .filter((i) => i.kind === "image")
    .map((i) => i.path)
    .slice(0, VIDEO_REFERENCE_IMAGE.maxCount);
  const referenceVideoPaths = items
    .filter((i) => i.kind === "video")
    .map((i) => i.path)
    .slice(0, VIDEO_REFERENCE_VIDEO.maxCount);
  const referenceAudioPaths = items
    .filter((i) => i.kind === "audio")
    .map((i) => i.path)
    .slice(0, VIDEO_REFERENCE_AUDIO.maxCount);
  return { referenceImagePaths, referenceVideoPaths, referenceAudioPaths };
}

/**
 * 缩略条展示顺序：自上而下遍历，各类型分别计数不超过上限。
 */
export function incomingRefsForDisplayStrip(items: VideoIncomingRefItem[]): VideoIncomingRefItem[] {
  let ic = 0;
  let vc = 0;
  let ac = 0;
  const out: VideoIncomingRefItem[] = [];
  for (const it of items) {
    if (it.kind === "image" && ic < VIDEO_REFERENCE_IMAGE.maxCount) {
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

/**
 * 根据连线输入自动检测当前应亮起的 workflow 状态。
 *
 * 规则：
 * - 有参考视频 → video_reference
 * - 2 张图片（无视频） → first_last_frame
 * - 有音频，或 1 张 / 3+ 张图片 → multimodal_reference
 * - 无连线但有文字 → text_to_video
 * - 无任何有效输入 → null（全部灭）
 */
export function detectWorkflow(
  items: VideoIncomingRefItem[],
  promptText: string,
): VideoGenerationWorkflow | null {
  const hasVideo = items.some((i) => i.kind === "video");
  const hasAudio = items.some((i) => i.kind === "audio");
  const images = items.filter((i) => i.kind === "image");
  const imageCount = images.length;
  const hasPrompt = promptText.trim().length > 0;

  // 有参考视频 → 参考视频模式
  if (hasVideo) return "video_reference";

  // 有音频 → 全能参考
  if (hasAudio) return "multimodal_reference";

  // 2 张纯图片 → 首尾帧
  if (imageCount === 2) return "first_last_frame";

  // 1 张或 3+ 张图片 → 全能参考
  if (imageCount >= 1) return "multimodal_reference";

  // 无连线，有文字 → 文生视频
  if (hasPrompt) return "text_to_video";

  // 没有任何输入
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
