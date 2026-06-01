import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData, ScriptBeat, StoryboardShot } from "@/lib/types";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import {
  formatComposeMissingHint,
  mapVideoNodesByScriptBeat,
  type ComposeMissingShot,
} from "@/lib/compose/buildFromScript";
import {
  resolveStoryboardBeatScope,
  type StoryboardBeatScope,
} from "@/lib/scriptStoryboardScope";
import {
  findImageNodesForScript,
  findVideoNodesForScript,
  shotHasGeneratedImage,
} from "@/lib/storyboard/storyboardMediaNodes";

export type BatchVideoSkipReason =
  | "not_in_scope"
  | "no_prompt"
  | "storyboard_failed"
  | "no_video_node"
  | "no_image"
  | "video_generating"
  | "video_ready"
  | "no_draft_prompt";

export type BatchVideoEligibleShot = {
  beatId: string;
  shotNumber: string;
  videoNodeId: string;
};

export type BatchVideoReadiness = {
  scope: StoryboardBeatScope;
  eligible: BatchVideoEligibleShot[];
  skipCounts: Partial<Record<BatchVideoSkipReason, number>>;
  canStart: boolean;
  blockMessage: string;
};

export type BatchImageSkipReason =
  | "not_in_scope"
  | "no_prompt"
  | "storyboard_failed"
  | "no_image_node"
  | "image_ready";

export type BatchImageEligibleShot = {
  beatId: string;
  shotNumber: string;
  imageNodeId?: string;
};

export type BatchImageReadiness = {
  scope: StoryboardBeatScope;
  eligible: BatchImageEligibleShot[];
  /** 有分镜文案但尚无图片节点，需先建链 */
  needsChainBuild: number;
  skipCounts: Partial<Record<BatchImageSkipReason, number>>;
  canStart: boolean;
  blockMessage: string;
};

export type ComposeExportReadiness = {
  scope: StoryboardBeatScope;
  readyCount: number;
  missingCount: number;
  totalInScope: number;
  missing: ComposeMissingShot[];
  canExport: boolean;
  blockMessage: string;
};

function shotNumberLabel(beat: ScriptBeat): string {
  return (beat.shotNumber || "").trim() || beat.id.slice(0, 6);
}

export function resolveProductionBeatScope(
  beats: ScriptBeat[],
  scriptBeatSelection: string[] | undefined,
) {
  return resolveStoryboardBeatScope(beats, scriptBeatSelection);
}

/** 批量视频：勾选范围 + 分镜图/视频节点/草稿 prompt 预检 */
export function assessBatchVideoReadiness(opts: {
  scriptNodeId: string;
  beats: ScriptBeat[];
  shots: StoryboardShot[] | undefined;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  scriptBeatSelection: string[] | undefined;
}): BatchVideoReadiness | { ok: false; message: string } {
  const scopeResult = resolveProductionBeatScope(opts.beats, opts.scriptBeatSelection);
  if (!scopeResult.ok) {
    return { ok: false, message: scopeResult.message };
  }
  const scope = scopeResult.scope;
  const beatsNorm = scope.beats;
  const scopeIds = new Set(beatsNorm.map((b) => b.id));
  const shotByBeat = new Map((opts.shots ?? []).map((s) => [s.scriptBeatId, s]));
  const videoByBeat = findVideoNodesForScript(opts.scriptNodeId, opts.nodes, opts.edges);
  const imageByBeat = findImageNodesForScript(opts.scriptNodeId, opts.nodes, opts.edges);

  const skipCounts: Partial<Record<BatchVideoSkipReason, number>> = {};
  const bump = (k: BatchVideoSkipReason) => {
    skipCounts[k] = (skipCounts[k] ?? 0) + 1;
  };

  const eligible: BatchVideoEligibleShot[] = [];

  for (const beat of normalizeScriptBeats(opts.beats)) {
    if (!scopeIds.has(beat.id)) {
      bump("not_in_scope");
      continue;
    }
    const shot = shotByBeat.get(beat.id);
    if (!shot?.visualPrompt?.trim()) {
      bump("no_prompt");
      continue;
    }
    if (shot.status === "failed") {
      bump("storyboard_failed");
      continue;
    }
    if (!videoByBeat.has(beat.id)) {
      bump("no_video_node");
      continue;
    }
    const imageNode = opts.nodes.find((n) => n.id === imageByBeat.get(beat.id));
    if (!shotHasGeneratedImage(beat.id, shot, imageNode)) {
      bump("no_image");
      continue;
    }
    if (shot.videoStatus === "generating") {
      bump("video_generating");
      continue;
    }
    if (shot.videoStatus === "generated") {
      bump("video_ready");
      continue;
    }
    const videoNodeId = videoByBeat.get(beat.id)!;
    const videoNode = opts.nodes.find((n) => n.id === videoNodeId);
    const draftPrompt = (videoNode?.data.video as { draft?: { prompt?: string } } | undefined)?.draft
      ?.prompt;
    if (!draftPrompt?.trim()) {
      bump("no_draft_prompt");
      continue;
    }
    eligible.push({
      beatId: beat.id,
      shotNumber: shotNumberLabel(beat),
      videoNodeId,
    });
  }

  let blockMessage = "";
  const canStart = eligible.length > 0;
  if (!canStart) {
    if (scope.mode === "selected" && scope.selectedCount === 0) {
      blockMessage = "请在工作台勾选要批量出视频的镜头";
    } else if ((skipCounts.no_video_node ?? 0) > 0) {
      blockMessage = "缺少视频节点：请先「一键建链（图+视频）」或「仅视频」";
    } else if ((skipCounts.no_image ?? 0) > 0) {
      blockMessage = "缺少分镜图：请先生成/导入分镜图";
    } else if ((skipCounts.video_ready ?? 0) === beatsNorm.length) {
      blockMessage = "范围内镜头视频均已生成";
    } else {
      blockMessage = "没有可提交批量视频的镜头";
    }
  }

  return { scope, eligible, skipCounts, canStart, blockMessage };
}

export function formatBatchVideoReadinessHint(r: BatchVideoReadiness): string {
  const parts = [`范围：${r.scope.mode === "selected" ? `勾选 ${r.scope.selectedCount}` : "全部"} 镜`];
  parts.push(`可提交 ${r.eligible.length} 个`);
  const skipEntries = Object.entries(r.skipCounts).filter(([, n]) => (n ?? 0) > 0);
  if (skipEntries.length > 0) {
    const labels: Record<BatchVideoSkipReason, string> = {
      not_in_scope: "范围外",
      no_prompt: "无分镜文案",
      storyboard_failed: "分镜失败",
      no_video_node: "无视频节点",
      no_image: "无分镜图",
      video_generating: "生成中",
      video_ready: "已有成片",
      no_draft_prompt: "无视频草稿",
    };
    const skipText = skipEntries
      .map(([k, n]) => `${labels[k as BatchVideoSkipReason] ?? k} ${n}`)
      .join("、");
    parts.push(`跳过 ${skipText}`);
  }
  return parts.join(" · ");
}

/** 批量出关键帧：勾选范围 + 分镜文案 / 图片节点 / 是否已有成片预检（E5 首切片） */
export function assessBatchImageReadiness(opts: {
  scriptNodeId: string;
  beats: ScriptBeat[];
  shots: StoryboardShot[] | undefined;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  scriptBeatSelection: string[] | undefined;
}): BatchImageReadiness | { ok: false; message: string } {
  const scopeResult = resolveProductionBeatScope(opts.beats, opts.scriptBeatSelection);
  if (!scopeResult.ok) {
    return { ok: false, message: scopeResult.message };
  }
  const scope = scopeResult.scope;
  const beatsNorm = scope.beats;
  const scopeIds = new Set(beatsNorm.map((b) => b.id));
  const shotByBeat = new Map((opts.shots ?? []).map((s) => [s.scriptBeatId, s]));
  const imageByBeat = findImageNodesForScript(opts.scriptNodeId, opts.nodes, opts.edges);

  const skipCounts: Partial<Record<BatchImageSkipReason, number>> = {};
  const bump = (k: BatchImageSkipReason) => {
    skipCounts[k] = (skipCounts[k] ?? 0) + 1;
  };

  const eligible: BatchImageEligibleShot[] = [];
  let needsChainBuild = 0;

  for (const beat of normalizeScriptBeats(opts.beats)) {
    if (!scopeIds.has(beat.id)) {
      bump("not_in_scope");
      continue;
    }
    const shot = shotByBeat.get(beat.id);
    if (!shot?.visualPrompt?.trim()) {
      bump("no_prompt");
      continue;
    }
    if (shot.status === "failed") {
      bump("storyboard_failed");
      continue;
    }
    const imageNodeId = imageByBeat.get(beat.id);
    if (!imageNodeId) {
      needsChainBuild += 1;
      eligible.push({
        beatId: beat.id,
        shotNumber: shotNumberLabel(beat),
      });
      continue;
    }
    const imageNode = opts.nodes.find((n) => n.id === imageNodeId);
    if (shotHasGeneratedImage(beat.id, shot, imageNode)) {
      bump("image_ready");
      continue;
    }
    eligible.push({
      beatId: beat.id,
      shotNumber: shotNumberLabel(beat),
      imageNodeId,
    });
  }

  let blockMessage = "";
  const canStart = eligible.length > 0;
  if (!canStart) {
    if (scope.mode === "selected" && scope.selectedCount === 0) {
      blockMessage = "请在工作台勾选要批量出图的镜头";
    } else if ((skipCounts.image_ready ?? 0) === beatsNorm.length) {
      blockMessage = "范围内镜头关键帧均已生成";
    } else if ((skipCounts.no_prompt ?? 0) > 0 && eligible.length === 0) {
      blockMessage = "请先生成分镜文案再批量出图";
    } else {
      blockMessage = "没有可提交批量出图的镜头";
    }
  }

  return { scope, eligible, needsChainBuild, skipCounts, canStart, blockMessage };
}

export function formatBatchImageReadinessHint(r: BatchImageReadiness): string {
  const parts = [`范围：${r.scope.mode === "selected" ? `勾选 ${r.scope.selectedCount}` : "全部"} 镜`];
  parts.push(`可提交 ${r.eligible.length} 个`);
  if (r.needsChainBuild > 0) {
    parts.push(`其中 ${r.needsChainBuild} 个需先建图片节点`);
  }
  const skipEntries = Object.entries(r.skipCounts).filter(([, n]) => (n ?? 0) > 0);
  if (skipEntries.length > 0) {
    const labels: Record<BatchImageSkipReason, string> = {
      not_in_scope: "范围外",
      no_prompt: "无分镜文案",
      storyboard_failed: "分镜失败",
      no_image_node: "无图片节点",
      image_ready: "已有图",
    };
    const skipText = skipEntries
      .map(([k, n]) => `${labels[k as BatchImageSkipReason] ?? k} ${n}`)
      .join("、");
    parts.push(`跳过 ${skipText}`);
  }
  return parts.join(" · ");
}

/** 合成导出：按勾选范围评估可导出镜数 */
export function assessComposeExportScope(opts: {
  scriptNodeId: string;
  beats: ScriptBeat[];
  shots: StoryboardShot[] | undefined;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  scriptBeatSelection: string[] | undefined;
}): ComposeExportReadiness | { ok: false; message: string } {
  const scopeResult = resolveProductionBeatScope(opts.beats, opts.scriptBeatSelection);
  if (!scopeResult.ok) {
    return { ok: false, message: scopeResult.message };
  }
  const scope = scopeResult.scope;
  const missing: ComposeMissingShot[] = [];
  let readyCount = 0;

  const shotByBeat = new Map((opts.shots ?? []).map((s) => [s.scriptBeatId, s]));
  const videoByBeat = mapVideoNodesByScriptBeat(
    opts.scriptNodeId,
    opts.nodes,
    opts.edges,
    opts.shots ?? [],
  );
  for (const beat of scope.beats) {
    const shotNumber = shotNumberLabel(beat);
    const videoNodeId = videoByBeat.get(beat.id);
    if (!videoNodeId) {
      missing.push({
        beatId: beat.id,
        shotNumber,
        reason: "no_video_node",
        message: `镜 ${shotNumber}：未关联视频节点`,
      });
      continue;
    }
    const shot = shotByBeat.get(beat.id);
    if (shot?.videoStatus === "generating") {
      missing.push({
        beatId: beat.id,
        shotNumber,
        reason: "generating",
        message: `镜 ${shotNumber}：视频生成中`,
      });
      continue;
    }
    const video = opts.nodes.find((n) => n.id === videoNodeId);
    if (!video?.data.path?.trim() && !video?.data.assetId?.trim()) {
      missing.push({
        beatId: beat.id,
        shotNumber,
        reason: "no_media",
        message: `镜 ${shotNumber}：视频未出片`,
      });
      continue;
    }
    readyCount += 1;
  }
  const canExport = readyCount > 0;
  const blockMessage = canExport
    ? ""
    : scope.mode === "selected" && scope.selectedCount === 0
      ? "请勾选要导出成片的镜头"
      : "范围内没有已出片的视频，请先批量生成视频";

  return {
    scope,
    readyCount,
    missingCount: missing.length,
    totalInScope: scope.beats.length,
    missing,
    canExport,
    blockMessage,
  };
}

export function formatComposeExportReadinessHint(r: ComposeExportReadiness): string {
  const scopeLabel =
    r.scope.mode === "selected" ? `勾选 ${r.scope.selectedCount}` : `全部 ${r.totalInScope}`;
  let msg = `导出范围 ${scopeLabel}：可纳入 ${r.readyCount} 镜`;
  if (r.missingCount > 0) {
    msg += formatComposeMissingHint(r.missing);
  }
  return msg;
}

export function listFailedVideoBeatIds(shots: StoryboardShot[] | undefined): string[] {
  return (shots ?? []).filter((s) => s.videoStatus === "failed").map((s) => s.scriptBeatId);
}

/** 分镜出图失败（storyboardShots.status === failed）的镜头，供 E5 批量重试 */
export function listFailedKeyframeBeatIds(shots: StoryboardShot[] | undefined): string[] {
  return (shots ?? [])
    .filter((s) => s.status === "failed" && s.visualPrompt?.trim())
    .map((s) => s.scriptBeatId);
}
