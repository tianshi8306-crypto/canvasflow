import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat, StoryboardShot } from "@/lib/types";
import { getScriptBeatIdFromParams } from "@/lib/incomingScriptBinding";
import { newNodeDataByType } from "@/lib/canvasNodeDefaults";
import { makeFlowEdge } from "@/lib/flowEdge";
import { findImageNodesForScript } from "@/lib/storyboard/batchGenerateImages";
import { findVideoNodesForScript } from "@/lib/storyboard/batchGenerateVideos";
import {
  defaultVideoGenerationDraft,
  defaultVideoNodePersisted,
} from "@/lib/videoNodeTypes";
import { resolveStoryboardBeatScope, type StoryboardBeatScope } from "@/lib/scriptStoryboardScope";

export type ChainMediaKind = "image" | "video" | "audio";

const CHAIN_GAP_X = 420;
const CHAIN_GAP_Y = 230;
const IMAGE_VIDEO_GAP_X = 400;

export type DownstreamByBeat = {
  imageNodeId?: string;
  videoNodeId?: string;
  audioNodeId?: string;
};

function beatIdFromNode(data: FlowNodeData): string | null {
  const id = getScriptBeatIdFromParams(data);
  return id?.trim() ? id : null;
}

/** 脚本节点直连下游、按 `params.scriptBeatId` 索引（每镜各类型取第一个） */
export function findDownstreamByBeat(
  scriptNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: { source: string; target: string }[],
): Map<string, DownstreamByBeat> {
  const linkedIds = new Set(
    edges.filter((e) => e.source === scriptNodeId).map((e) => e.target),
  );
  const map = new Map<string, DownstreamByBeat>();

  const imageByBeat = findImageNodesForScript(scriptNodeId, nodes, edges);
  const videoByBeat = findVideoNodesForScript(scriptNodeId, nodes, edges);

  for (const [beatId, nodeId] of imageByBeat) {
    const cur = map.get(beatId) ?? {};
    cur.imageNodeId = nodeId;
    map.set(beatId, cur);
  }
  for (const [beatId, nodeId] of videoByBeat) {
    const cur = map.get(beatId) ?? {};
    cur.videoNodeId = nodeId;
    map.set(beatId, cur);
  }

  for (const n of nodes) {
    if (n.type !== "audioNode" || !linkedIds.has(n.id)) continue;
    const beatId = beatIdFromNode(n.data);
    if (!beatId || map.get(beatId)?.audioNodeId) continue;
    const cur = map.get(beatId) ?? {};
    cur.audioNodeId = n.id;
    map.set(beatId, cur);
  }

  return map;
}

export type ScriptBeatChainBuildResult = {
  scope: StoryboardBeatScope;
  newNodes: Node<FlowNodeData>[];
  newEdges: Edge[];
  created: Record<ChainMediaKind, number>;
  skipped: Record<ChainMediaKind, number>;
};

function mergeParams(
  base: Record<string, unknown> | undefined,
  scriptBeatId: string,
  shotNumber: string,
): Record<string, unknown> {
  return {
    ...(base && typeof base === "object" ? base : {}),
    scriptBeatId,
    shotNumber,
  };
}

function buildImageNode(
  beat: ScriptBeat,
  shot: StoryboardShot | undefined,
  position: { x: number; y: number },
): Node<FlowNodeData> {
  const shotNo = (beat.shotNumber || "").trim() || "—";
  const promptParts = [shot?.visualPrompt?.trim() || beat.description?.trim() || ""].filter(Boolean);
  const data = newNodeDataByType.imageNode();
  data.label = `镜头 ${shotNo} 图`;
  if (promptParts.length) data.prompt = promptParts.join("\n");
  data.params = mergeParams(
    typeof data.params === "object" && data.params ? (data.params as Record<string, unknown>) : undefined,
    beat.id,
    shotNo,
  );
  return {
    id: crypto.randomUUID(),
    type: "imageNode",
    position,
    data,
  };
}

function buildVideoNode(
  beat: ScriptBeat,
  shot: StoryboardShot | undefined,
  position: { x: number; y: number },
): Node<FlowNodeData> {
  const shotNo = (beat.shotNumber || "").trim() || "—";
  const promptParts = [
    shot?.visualPrompt?.trim() || beat.description?.trim() || "",
    beat.videoMotionPrompt?.trim() ? `运镜：${beat.videoMotionPrompt.trim()}` : "",
  ].filter(Boolean);
  const data = newNodeDataByType.videoNode();
  data.label = `镜头 ${shotNo} 视频`;
  data.video = {
    ...defaultVideoNodePersisted(),
    draft: {
      ...defaultVideoGenerationDraft(),
      ...data.video?.draft,
      workflow: "text_to_video",
      prompt: promptParts.join("\n"),
    },
  };
  data.params = mergeParams(
    typeof data.params === "object" && data.params ? (data.params as Record<string, unknown>) : undefined,
    beat.id,
    shotNo,
  );
  return {
    id: crypto.randomUUID(),
    type: "videoNode",
    position,
    data,
  };
}

function buildAudioNode(beat: ScriptBeat, position: { x: number; y: number }): Node<FlowNodeData> {
  const shotNo = (beat.shotNumber || "").trim() || "—";
  const hint = [beat.dialogue?.trim(), beat.soundEffect?.trim()].filter(Boolean);
  const data = newNodeDataByType.audioNode();
  data.label = `镜头 ${shotNo} 音频`;
  if (hint.length) data.prompt = hint.join("\n");
  data.params = mergeParams(
    typeof data.params === "object" && data.params ? (data.params as Record<string, unknown>) : undefined,
    beat.id,
    shotNo,
  );
  return {
    id: crypto.randomUUID(),
    type: "audioNode",
    position,
    data,
  };
}

export function resolveChainBuildScope(
  beats: ScriptBeat[],
  scriptBeatSelection: string[] | undefined,
) {
  return resolveStoryboardBeatScope(beats, scriptBeatSelection);
}

/**
 * 按勾选范围（有勾选仅勾选，否则全部）创建下游媒体节点并写入 `params.scriptBeatId`。
 * `kinds` 含 image+video 时采用「脚本→图→视频」横向配对布局。
 */
export function buildScriptBeatChain(opts: {
  scriptNodeId: string;
  anchor: Node<FlowNodeData>;
  beats: ScriptBeat[];
  scriptBeatSelection: string[] | undefined;
  shots?: StoryboardShot[] | undefined;
  nodes: Node<FlowNodeData>[];
  edges: { source: string; target: string }[];
  kinds: ChainMediaKind[];
  skipExisting?: boolean;
}): ScriptBeatChainBuildResult | { ok: false; message: string } {
  const scopeResult = resolveChainBuildScope(opts.beats, opts.scriptBeatSelection);
  if (!scopeResult.ok) return scopeResult;

  const skipExisting = opts.skipExisting !== false;
  const scope = scopeResult.scope;
  const shotMap = new Map((opts.shots ?? []).map((s) => [s.scriptBeatId, s]));
  const existing = findDownstreamByBeat(opts.scriptNodeId, opts.nodes, opts.edges);

  const newNodes: Node<FlowNodeData>[] = [];
  const newEdges: Edge[] = [];
  const created: Record<ChainMediaKind, number> = { image: 0, video: 0, audio: 0 };
  const skipped: Record<ChainMediaKind, number> = { image: 0, video: 0, audio: 0 };

  const wantImage = opts.kinds.includes("image");
  const wantVideo = opts.kinds.includes("video");
  const wantAudio = opts.kinds.includes("audio");
  const pairedImageVideo = wantImage && wantVideo;

  const startY =
    opts.anchor.position.y - ((scope.beats.length - 1) * CHAIN_GAP_Y) / 2;

  for (const [i, beat] of scope.beats.entries()) {
    const shot = shotMap.get(beat.id);
    const ex = existing.get(beat.id) ?? {};
    const rowY = startY + i * CHAIN_GAP_Y;
    const baseX = opts.anchor.position.x + CHAIN_GAP_X;

    let imageNode: Node<FlowNodeData> | null = null;
    let videoNode: Node<FlowNodeData> | null = null;

    if (wantImage) {
      if (skipExisting && ex.imageNodeId) {
        skipped.image += 1;
        const prev = opts.nodes.find((n) => n.id === ex.imageNodeId);
        if (prev) imageNode = prev;
      } else {
        imageNode = buildImageNode(beat, shot, { x: baseX, y: rowY });
        newNodes.push(imageNode);
        newEdges.push(makeFlowEdge(opts.scriptNodeId, imageNode.id, "scriptNode"));
        created.image += 1;
      }
    }

    if (wantVideo) {
      if (skipExisting && ex.videoNodeId) {
        skipped.video += 1;
      } else {
        const videoX = pairedImageVideo && imageNode ? imageNode.position.x + IMAGE_VIDEO_GAP_X : baseX;
        const videoY = pairedImageVideo && imageNode ? imageNode.position.y : rowY;
        videoNode = buildVideoNode(beat, shot, { x: videoX, y: videoY });
        newNodes.push(videoNode);
        if (imageNode) {
          newEdges.push(makeFlowEdge(imageNode.id, videoNode.id, "imageNode"));
        } else {
          newEdges.push(makeFlowEdge(opts.scriptNodeId, videoNode.id, "scriptNode"));
        }
        created.video += 1;
      }
    }

    if (wantAudio) {
      if (skipExisting && ex.audioNodeId) {
        skipped.audio += 1;
      } else {
        const audioNode = buildAudioNode(beat, {
          x: baseX + (pairedImageVideo ? IMAGE_VIDEO_GAP_X + 80 : 0),
          y: rowY,
        });
        newNodes.push(audioNode);
        newEdges.push(makeFlowEdge(opts.scriptNodeId, audioNode.id, "scriptNode"));
        created.audio += 1;
      }
    }
  }

  return {
    scope,
    newNodes,
    newEdges,
    created,
    skipped,
  };
}

export function formatChainBuildStatus(result: ScriptBeatChainBuildResult): string {
  const parts: string[] = [];
  if (result.created.image) parts.push(`图片 ${result.created.image}`);
  if (result.created.video) parts.push(`视频 ${result.created.video}`);
  if (result.created.audio) parts.push(`音频 ${result.created.audio}`);
  const skipParts: string[] = [];
  if (result.skipped.image) skipParts.push(`图片 ${result.skipped.image} 已存在`);
  if (result.skipped.video) skipParts.push(`视频 ${result.skipped.video} 已存在`);
  if (result.skipped.audio) skipParts.push(`音频 ${result.skipped.audio} 已存在`);
  const scopeLabel =
    result.scope.mode === "selected"
      ? `勾选 ${result.scope.selectedCount} 镜`
      : `全部 ${result.scope.totalCount} 镜`;
  let msg = parts.length ? `已为${scopeLabel}创建：${parts.join("、")}` : `未新建节点（${scopeLabel}）`;
  if (skipParts.length) msg += `；跳过 ${skipParts.join("，")}`;
  return msg;
}
