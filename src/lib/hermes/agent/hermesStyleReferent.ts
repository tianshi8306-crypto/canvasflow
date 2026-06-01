import type { HermesCanvasEvent } from "@/lib/hermes/agent/hermesCanvasEvents";
import { findPrimaryScriptNode } from "@/lib/hermes/hermesCanvasContext";
import type { ProjectBible } from "@/lib/projectBible/projectBible";
import type { FlowNodeData } from "@/lib/types";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import {
  findImageNodesForScript,
  findVideoNodesForScript,
  shotHasGeneratedImage,
  shotHasGeneratedVideo,
} from "@/lib/storyboard/storyboardMediaNodes";
import { getCachedHermesWorkstate } from "@/lib/hermes/agent/hermesWorkstate";
import { useProjectStore } from "@/store/projectStore";
import type { Edge, Node } from "@xyflow/react";

/** iter-102：用户说「按上面风格」时的参考锚点 */
export type HermesStyleAnchor = {
  shotNumber?: string;
  beatId?: string;
  visualPromptSnippet?: string;
  bibleVisualStyle?: string;
  videoMotionSnippet?: string;
  source: "storyboard_edit" | "bible" | "image_ready" | "video_ready";
  at: string;
};

export const STYLE_ANCHOR_TTL_MS = 60 * 60_000;

const STYLE_REFERENT_RE =
  /按(?:上面|刚才|同样|相同|那个)|(?:同样|一样|相同)(?:的)?(?:风格|画风|质感|调性)|风格(?:跟|像)(?:上面|刚才|那镜)|跟(?:上面|刚才|那镜)一样|沿用(?:上面|刚才)(?:的)?(?:风格|画风)/;

const MOTION_REFERENT_RE =
  /按(?:上面|刚才|同样|相同|那个)(?:的)?运镜|(?:同样|一样|相同)(?:的)?运镜|运镜(?:跟|像)(?:上面|刚才|那镜)|跟(?:上面|刚才|那镜)一样运镜|沿用(?:上面|刚才)(?:的)?运镜/;

export function messageHasStyleReferent(text: string): boolean {
  return STYLE_REFERENT_RE.test(text.trim());
}

export function messageHasMotionReferent(text: string): boolean {
  return MOTION_REFERENT_RE.test(text.trim());
}

export function isStyleAnchorFresh(
  anchor: HermesStyleAnchor | undefined,
): boolean {
  if (!anchor) return false;
  const t = Date.parse(anchor.at);
  if (!Number.isFinite(t) || Date.now() - t >= STYLE_ANCHOR_TTL_MS) return false;
  return Boolean(
    anchor.visualPromptSnippet?.trim() ||
    anchor.bibleVisualStyle?.trim() ||
    anchor.videoMotionSnippet?.trim(),
  );
}

export function styleAnchorFromCanvasEvent(
  event: HermesCanvasEvent,
): HermesStyleAnchor | null {
  if (event.kind !== "storyboard_edited") return null;
  const snippet = event.visualPromptSnippet?.trim();
  if (!snippet) return null;
  return {
    shotNumber: event.shotNumber?.trim() || undefined,
    beatId: event.beatId,
    visualPromptSnippet: snippet.slice(0, 160),
    source: "storyboard_edit",
    at: event.at,
  };
}

export function styleAnchorFromBible(
  bible: ProjectBible | null,
): HermesStyleAnchor | null {
  const vs = bible?.visualStyle?.trim();
  if (!vs) return null;
  return {
    bibleVisualStyle: vs.slice(0, 120),
    source: "bible",
    at: new Date().toISOString(),
  };
}

export function pickLatestStyleAnchorFromEvents(
  events: HermesCanvasEvent[],
): HermesStyleAnchor | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const a = styleAnchorFromCanvasEvent(events[i]!);
    if (a) return a;
  }
  return null;
}

export function mergeStyleAnchor(
  prev: HermesStyleAnchor | undefined,
  next: HermesStyleAnchor | null,
): HermesStyleAnchor | undefined {
  if (!next) return prev;
  if (!prev) return next;
  const prevT = Date.parse(prev.at);
  const nextT = Date.parse(next.at);
  if (Number.isFinite(prevT) && Number.isFinite(nextT) && prevT > nextT) {
    return prev;
  }
  return next;
}

export function getActiveStyleAnchor(): HermesStyleAnchor | undefined {
  const ws = getCachedHermesWorkstate();
  const a = ws?.lastStyleAnchor;
  return isStyleAnchorFresh(a) ? a : undefined;
}

export function formatStyleAnchorForPrompt(
  anchor: HermesStyleAnchor | undefined,
): string {
  if (!isStyleAnchorFresh(anchor)) return "";
  const parts: string[] = [];
  if (anchor!.visualPromptSnippet) {
    const shot = anchor!.shotNumber ? `镜 ${anchor!.shotNumber}` : "参考镜";
    const src =
      anchor!.source === "image_ready"
        ? "关键帧"
        : anchor!.source === "video_ready"
          ? "视频"
          : anchor!.source === "bible"
            ? "圣经"
            : "分镜";
    parts.push(`${shot}（${src}）画面：${anchor!.visualPromptSnippet.slice(0, 100)}`);
  }
  if (anchor!.videoMotionSnippet) {
    parts.push(`运镜参考：${anchor!.videoMotionSnippet.slice(0, 80)}`);
  }
  if (anchor!.bibleVisualStyle) {
    parts.push(`圣经视觉风格：${anchor!.bibleVisualStyle.slice(0, 80)}`);
  }
  return `风格参考锚点（用户说「按上面/同样风格」时优先）：${parts.join("；")}`;
}

export function resolveStyleReferenceVisual(
  anchor: HermesStyleAnchor | undefined,
): string | undefined {
  if (!isStyleAnchorFresh(anchor)) return undefined;
  if (anchor!.visualPromptSnippet?.trim()) {
    return anchor!.visualPromptSnippet.trim();
  }
  if (anchor!.bibleVisualStyle?.trim()) {
    return `整体视觉风格：${anchor!.bibleVisualStyle.trim()}`;
  }
  return undefined;
}

export function resolveStyleReferenceMotion(
  anchor: HermesStyleAnchor | undefined,
): string | undefined {
  if (!isStyleAnchorFresh(anchor)) return undefined;
  return anchor!.videoMotionSnippet?.trim() || undefined;
}

/** 将参考 visual 融入目标镜现有文案 */
export function mergeVisualWithStyleReference(
  currentVisual: string,
  referenceVisual: string,
): string {
  const ref = referenceVisual.trim().slice(0, 160);
  if (!ref) return currentVisual.trim();
  const cur = currentVisual.trim();
  if (!cur) return ref;
  if (cur === ref) return cur;
  if (ref.startsWith(cur)) return cur;
  if (cur.startsWith(ref)) return cur;
  const head = ref.slice(0, Math.min(36, ref.length));
  if (head.length >= 8 && cur.includes(head)) return cur;
  return `${cur}。画面风格与参考一致：${ref.slice(0, 100)}`;
}

export function styleReferenceShotNumber(
  anchor: HermesStyleAnchor | undefined,
): number | undefined {
  if (!anchor?.shotNumber?.trim()) return undefined;
  const n = parseInt(anchor.shotNumber.trim(), 10);
  return n >= 1 && n < 200 ? n : undefined;
}

/** 从脚本 beat 构建风格锚（出图成功 / patch 后） */
export function buildStyleAnchorFromScriptBeat(
  scriptNode: Node<FlowNodeData>,
  beatId: string,
): HermesStyleAnchor | null {
  const beats = normalizeScriptBeats(scriptNode.data.scriptBeats);
  const idx = beats.findIndex((b) => b.id === beatId);
  const beat = idx >= 0 ? beats[idx]! : undefined;
  if (!beat) return null;
  const shot = (scriptNode.data.storyboardShots ?? []).find(
    (s) => s.scriptBeatId === beatId,
  );
  const visual =
    shot?.visualPrompt?.trim() ||
    beat.description?.trim() ||
    "";
  if (!visual) return null;
  const shotNumber = (beat.shotNumber ?? "").trim() || String(idx + 1);
  return {
    shotNumber,
    beatId,
    visualPromptSnippet: visual.slice(0, 160),
    source: "image_ready",
    at: new Date().toISOString(),
  };
}

/**
 * 无明确镜号时：批量套用风格的目标镜（默认优先缺关键帧，排除参考镜本身）。
 */
export function pickStyleCloneBatchShotNumbers(
  anchor: HermesStyleAnchor,
  userMessage: string,
  max = 8,
): number[] {
  const { nodes, edges } = useProjectStore.getState();
  const script = findPrimaryScriptNode(nodes);
  if (!script) return [];

  const beats = normalizeScriptBeats(script.data.scriptBeats);
  const refShot = styleReferenceShotNumber(anchor);
  const preferMissing =
    /缺图|没出图|未出图|其余|剩下的|其它|其他镜/.test(userMessage) ||
    (/出图|关键帧|生图/.test(userMessage) &&
      !/全部|所有镜|每一镜/.test(userMessage));
  const allScope = /全部|所有镜|每一镜|批量/.test(userMessage);
  const imageByBeat = findImageNodesForScript(script.id, nodes, edges as Edge[]);

  const nums: number[] = [];
  beats.forEach((beat, i) => {
    const n = i + 1;
    if (refShot && n === refShot) return;
    const shot = (script.data.storyboardShots ?? []).find(
      (s) => s.scriptBeatId === beat.id,
    );
    const imageNode = nodes.find((nd) => nd.id === imageByBeat.get(beat.id));
    const hasImage = shotHasGeneratedImage(beat.id, shot, imageNode);
    if (preferMissing && hasImage) return;
    if (!preferMissing && !allScope && hasImage) return;
    nums.push(n);
  });
  return nums.slice(0, max);
}

/**
 * 无明确镜号时：批量套用运镜的目标镜（默认优先缺成片视频，排除参考镜本身）。
 */
export function pickMotionCloneBatchShotNumbers(
  anchor: HermesStyleAnchor,
  userMessage: string,
  max = 8,
): number[] {
  const { nodes, edges } = useProjectStore.getState();
  const script = findPrimaryScriptNode(nodes);
  if (!script) return [];

  const beats = normalizeScriptBeats(script.data.scriptBeats);
  const refShot = styleReferenceShotNumber(anchor);
  const preferMissing =
    /缺视频|没出视频|未出视频|其余|剩下的|其它|其他镜/.test(userMessage) ||
    (/出视频|视频|成片/.test(userMessage) &&
      !/全部|所有镜|每一镜/.test(userMessage));
  const allScope = /全部|所有镜|每一镜|批量/.test(userMessage);
  const videoByBeat = findVideoNodesForScript(script.id, nodes, edges as Edge[]);

  const nums: number[] = [];
  beats.forEach((beat, i) => {
    const n = i + 1;
    if (refShot && n === refShot) return;
    const videoNode = nodes.find((nd) => nd.id === videoByBeat.get(beat.id));
    const hasVideo = shotHasGeneratedVideo(videoNode);
    if (preferMissing && hasVideo) return;
    if (!preferMissing && !allScope && hasVideo) return;
    nums.push(n);
  });
  return nums.slice(0, max);
}

/** 视频节点提交/成功后记录运镜锚点 */
export function buildStyleAnchorFromVideoBeat(
  scriptNode: Node<FlowNodeData>,
  beatId: string,
  videoDraftPrompt?: string,
): HermesStyleAnchor | null {
  const beats = normalizeScriptBeats(scriptNode.data.scriptBeats);
  const idx = beats.findIndex((b) => b.id === beatId);
  const beat = idx >= 0 ? beats[idx]! : undefined;
  const motion =
    beat?.videoMotionPrompt?.trim() ||
    videoDraftPrompt?.trim() ||
    "";
  const base = buildStyleAnchorFromScriptBeat(scriptNode, beatId);
  if (!motion && !base?.visualPromptSnippet) return null;
  const shotNumber =
    base?.shotNumber ||
    (beat ? (beat.shotNumber ?? "").trim() || String(idx + 1) : undefined);
  return {
    shotNumber,
    beatId,
    visualPromptSnippet: base?.visualPromptSnippet,
    videoMotionSnippet: motion ? motion.slice(0, 160) : undefined,
    source: "video_ready",
    at: new Date().toISOString(),
  };
}
