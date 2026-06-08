import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { collectClipsFromEdges } from "@/lib/compose/collectClips";
import {
  composeClipToTimeline,
  normalizeTimelineClips,
  timelineClipsToNodePatch,
  type ComposeTimelineClip,
} from "@/lib/compose/timelineClips";

export type SyncIncomingComposeClipResult =
  | { ok: true; clips: ComposeTimelineClip[]; added: boolean; updated: boolean }
  | { ok: false; reason: "no_media" | "source_not_found" };

/**
 * 将新连入剪辑节点的上游视频（或嵌套合成输出）合并进时间线。
 * 已存在同 sourceNodeId 的片段时更新路径；否则追加到末尾。
 */
export async function mergeIncomingSourceIntoComposeTimeline(
  composeNodeId: string,
  sourceNodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  projectPath: string,
): Promise<SyncIncomingComposeClipResult> {
  const compose = nodes.find((n) => n.id === composeNodeId && n.type === "ffmpegConcat");
  if (!compose) return { ok: false, reason: "source_not_found" };

  const collected = await collectClipsFromEdges(composeNodeId, nodes, edges, projectPath);
  const incoming = collected.find((c) => c.sourceNodeId === sourceNodeId);
  if (!incoming?.relPath?.trim()) {
    return { ok: false, reason: "no_media" };
  }

  const existing = normalizeTimelineClips(compose.data);
  const idx = existing.findIndex((c) => c.sourceNodeId === sourceNodeId);

  if (idx >= 0) {
    const prev = existing[idx]!;
    if (prev.relPath === incoming.relPath && prev.label === incoming.label) {
      return { ok: true, clips: existing, added: false, updated: false };
    }
    const next = [...existing];
    next[idx] = {
      ...prev,
      relPath: incoming.relPath,
      label: incoming.label ?? prev.label,
      scriptBeatId: incoming.scriptBeatId ?? prev.scriptBeatId,
    };
    return { ok: true, clips: next, added: false, updated: true };
  }

  return {
    ok: true,
    clips: [...existing, composeClipToTimeline(incoming)],
    added: true,
    updated: false,
  };
}

export function composeTimelinePatchFromMerge(
  result: Extract<SyncIncomingComposeClipResult, { ok: true }>,
): Pick<FlowNodeData, "timelineClips" | "inputs"> {
  return timelineClipsToNodePatch(result.clips);
}

type ComposeClipSyncCallbacks = {
  updateNodeData: (
    id: string,
    patch: Partial<FlowNodeData>,
    opts?: { silent?: boolean },
  ) => void;
  setStatusText?: (msg: string) => void;
};

/** 连线或出片后：合并上游片段并写回剪辑节点（供 store / 轮询复用） */
export async function applyIncomingComposeClipSync(
  composeNodeId: string,
  sourceNodeId: string,
  projectPath: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  callbacks: ComposeClipSyncCallbacks,
  opts?: { quiet?: boolean },
): Promise<boolean> {
  const result = await mergeIncomingSourceIntoComposeTimeline(
    composeNodeId,
    sourceNodeId,
    nodes,
    edges,
    projectPath,
  );
  if (!result.ok) {
    if (!opts?.quiet && result.reason === "no_media" && callbacks.setStatusText) {
      callbacks.setStatusText("连线已建立：上游视频尚未出片，出片后请点「从连线刷新」或重新连线");
    }
    return false;
  }
  if (!result.added && !result.updated) return true;
  callbacks.updateNodeData(composeNodeId, composeTimelinePatchFromMerge(result), { silent: true });
  if (!opts?.quiet && callbacks.setStatusText) {
    const label = nodes.find((n) => n.id === sourceNodeId)?.data.label?.trim() || "视频";
    callbacks.setStatusText(
      result.added ? `已将「${label}」导入剪辑时间线` : `已更新剪辑时间线中的「${label}」`,
    );
  }
  return true;
}
