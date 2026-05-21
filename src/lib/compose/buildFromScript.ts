import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat, StoryboardShot } from "@/lib/types";
import { getScriptBeatIdFromParams } from "@/lib/incomingScriptBinding";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import { findVideoNodesForScript } from "@/lib/storyboard/batchGenerateVideos";
import { resolveAssetRelPath } from "@/shared/api/assets";
import type { ComposeClip } from "./collectClips";

export type ComposeMissingReason = "no_video_node" | "no_media" | "generating";

export type ComposeMissingShot = {
  beatId: string;
  shotNumber: string;
  reason: ComposeMissingReason;
  message: string;
};

export type ScriptComposeBuildResult = {
  clips: ComposeClip[];
  clipPaths: string[];
  missing: ComposeMissingShot[];
  videoNodeIds: string[];
};

/** 按 scriptBeatId 解析关联的 videoNode（不依赖 script 直连边）。 */
export function mapVideoNodesByScriptBeat(
  scriptNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  shots: StoryboardShot[],
): Map<string, string> {
  const map = new Map<string, string>();

  for (const shot of shots) {
    const vid = shot.videoNodeId?.trim();
    if (vid) map.set(shot.scriptBeatId, vid);
  }

  for (const n of nodes) {
    if (n.type !== "videoNode") continue;
    const beatId = getScriptBeatIdFromParams(n.data);
    if (beatId && !map.has(beatId)) map.set(beatId, n.id);
  }

  const byEdge = findVideoNodesForScript(scriptNodeId, nodes, edges);
  for (const [beatId, nodeId] of byEdge) {
    if (!map.has(beatId)) map.set(beatId, nodeId);
  }

  return map;
}

function missingMessage(reason: ComposeMissingReason, shotNumber: string): string {
  switch (reason) {
    case "no_video_node":
      return `镜 ${shotNumber}：未关联视频节点`;
    case "no_media":
      return `镜 ${shotNumber}：视频未出片`;
    case "generating":
      return `镜 ${shotNumber}：视频生成中`;
  }
}

/** 同步评估可导出镜数（不解析 assetId）。 */
export function assessScriptComposeReadiness(
  beats: ScriptBeat[],
  shots: StoryboardShot[],
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  scriptNodeId: string,
  beatIds?: string[],
): { readyCount: number; missingCount: number; totalBeats: number } {
  let beatsNorm = normalizeScriptBeats(beats);
  if (beatIds?.length) {
    const set = new Set(beatIds);
    beatsNorm = beatsNorm.filter((b) => set.has(b.id));
  }
  const videoByBeat = mapVideoNodesByScriptBeat(scriptNodeId, nodes, edges, shots);
  const shotByBeat = new Map(shots.map((s) => [s.scriptBeatId, s]));

  let readyCount = 0;
  let missingCount = 0;

  for (const beat of beatsNorm) {
    const videoNodeId = videoByBeat.get(beat.id);
    if (!videoNodeId) {
      missingCount += 1;
      continue;
    }
    const shot = shotByBeat.get(beat.id);
    if (shot?.videoStatus === "generating") {
      missingCount += 1;
      continue;
    }
    const video = nodes.find((n) => n.id === videoNodeId);
    const hasMedia = Boolean(video?.data.path?.trim() || video?.data.assetId?.trim());
    if (!hasMedia) {
      missingCount += 1;
      continue;
    }
    readyCount += 1;
  }

  return { readyCount, missingCount, totalBeats: beatsNorm.length };
}

/** 按 scriptBeats 顺序收集可拼接片段路径。 */
export async function buildComposeClipsFromScript(opts: {
  scriptNodeId: string;
  beats: ScriptBeat[];
  shots: StoryboardShot[];
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  projectPath: string;
  beatIds?: string[];
}): Promise<ScriptComposeBuildResult> {
  const { scriptNodeId, beats, shots, nodes, edges, projectPath, beatIds } = opts;
  let beatsNorm = normalizeScriptBeats(beats);
  if (beatIds?.length) {
    const set = new Set(beatIds);
    beatsNorm = beatsNorm.filter((b) => set.has(b.id));
  }
  const videoByBeat = mapVideoNodesByScriptBeat(scriptNodeId, nodes, edges, shots);
  const shotByBeat = new Map(shots.map((s) => [s.scriptBeatId, s]));

  const clips: ComposeClip[] = [];
  const missing: ComposeMissingShot[] = [];
  const videoNodeIds: string[] = [];

  for (const beat of beatsNorm) {
    const shotNumber = beat.shotNumber?.trim() || beat.id.slice(0, 6);
    const videoNodeId = videoByBeat.get(beat.id);
    if (!videoNodeId) {
      missing.push({
        beatId: beat.id,
        shotNumber,
        reason: "no_video_node",
        message: missingMessage("no_video_node", shotNumber),
      });
      continue;
    }

    videoNodeIds.push(videoNodeId);
    const shot = shotByBeat.get(beat.id);
    if (shot?.videoStatus === "generating") {
      missing.push({
        beatId: beat.id,
        shotNumber,
        reason: "generating",
        message: missingMessage("generating", shotNumber),
      });
      continue;
    }

    const video = nodes.find((n) => n.id === videoNodeId);
    if (!video || video.type !== "videoNode") {
      missing.push({
        beatId: beat.id,
        shotNumber,
        reason: "no_video_node",
        message: missingMessage("no_video_node", shotNumber),
      });
      continue;
    }

    const relPath = await resolveAssetRelPath(projectPath, video.data.path, video.data.assetId);
    if (!relPath) {
      missing.push({
        beatId: beat.id,
        shotNumber,
        reason: "no_media",
        message: missingMessage("no_media", shotNumber),
      });
      continue;
    }

    clips.push({
      sourceNodeId: videoNodeId,
      relPath,
      scriptBeatId: beat.id,
      label: video.data.label?.trim() || `镜 ${shotNumber}`,
    });
  }

  return {
    clips,
    clipPaths: clips.map((c) => c.relPath),
    missing,
    videoNodeIds: [...new Set(videoNodeIds)],
  };
}

/** 查找已关联本脚本视频节点的合成节点。 */
/** 状态栏用的缺失镜头摘要。 */
export function formatComposeMissingHint(missing: ComposeMissingShot[]): string {
  if (missing.length === 0) return "";
  const samples = missing.slice(0, 3).map((m) => m.message).join("；");
  const tail = missing.length > 3 ? `等 ${missing.length} 镜` : "";
  return `；未纳入 ${missing.length} 镜：${samples}${tail}`;
}

export function findConcatNodeForScriptVideos(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  videoNodeIds: readonly string[],
): string | null {
  if (videoNodeIds.length === 0) return null;
  const idSet = new Set(videoNodeIds);
  for (const n of nodes) {
    if (n.type !== "ffmpegConcat") continue;
    const linked = edges.some((e) => e.target === n.id && idSet.has(e.source));
    if (linked) return n.id;
  }
  return null;
}
