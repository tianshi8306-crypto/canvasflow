import type { Edge, Node } from "@xyflow/react";
import { formatCanvasReferentForPrompt } from "@/lib/hermes/agent/hermesCanvasReferent";
import { formatCachedCanvasEventsForPrompt } from "@/lib/hermes/agent/hermesCanvasEventCache";
import { formatVersionStyleReferentForPrompt } from "@/lib/hermes/agent/hermesVersionReferent";
import { formatStyleAnchorForPrompt } from "@/lib/hermes/agent/hermesStyleReferent";
import { getCachedHermesWorkstate } from "@/lib/hermes/agent/hermesWorkstate";
import {
  buildHermesCanvasContext,
  findPrimaryScriptNode,
  type HermesCanvasContext,
} from "@/lib/hermes/hermesCanvasContext";
import {
  inferHermesCreativeStage,
  type HermesCreativeStageId,
} from "@/lib/hermes/hermesCreativeStage";
import { formatBibleForHermesContext } from "@/lib/projectBible/bibleRoleBindings";
import { bibleCharacterRefCount, type ProjectBible } from "@/lib/projectBible/projectBible";
import type { FlowNodeData, ScriptBeat, StoryboardShot } from "@/lib/types";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import {
  assessBatchVideoReadiness,
  assessComposeExportScope,
} from "@/lib/storyboard/scriptProductionExport";
import {
  beatIdFromNode,
  findImageNodesForScript,
  shotHasGeneratedImage,
} from "@/lib/storyboard/storyboardMediaNodes";
import { formatHermesGlobalUnderstandingForLlm } from "@/lib/hermes/hermesGlobalUnderstanding";
import { formatHermesExpertDoctrineForLlm } from "@/lib/hermes/hermesProductionExpert";
import {
  formatHermesProjectProfileForLlm,
  inferHermesProductionProjectType,
} from "@/lib/hermes/hermesProjectProfile";
import {
  detectProductionIssues,
  productionIssueToGap,
} from "@/lib/hermes/hermesProductionIssues";
import { filterGapsForSituationCard } from "@/lib/hermes/hermesProactivePolicy";

export type HermesSituationGapSeverity = "info" | "warn" | "block";

export type HermesSituationGap = {
  id: string;
  severity: HermesSituationGapSeverity;
  message: string;
  suggestedPrompt?: string;
};

export type HermesProductionSnapshot = {
  beatCount: number;
  storyboardReady: number;
  storyboardMissing: number;
  storyboardFailed: number;
  imageReady: number;
  imageMissing: number;
  videoGenerated: number;
  videoFailed: number;
  videoEligible: number;
  videoMissing: number;
  exportReady: number;
  exportTotal: number;
};

export type HermesSelectionSnapshot = {
  mode: "none" | "single" | "multi";
  nodeId?: string;
  label?: string;
  beatShotNumber?: string;
};

export type HermesSituation = {
  ctx: HermesCanvasContext;
  stageId: HermesCreativeStageId;
  stageLabel: string;
  production: HermesProductionSnapshot;
  gaps: HermesSituationGap[];
  selection: HermesSelectionSnapshot;
  bible: ProjectBible | null;
  /** 侧栏/灵体一行摘要 */
  headline: string;
};

function shotNumberLabel(beat: ScriptBeat): string {
  return (beat.shotNumber || "").trim() || beat.id.slice(0, 6);
}

function readyStoryboardShots(shots: StoryboardShot[] | undefined): StoryboardShot[] {
  return (shots ?? []).filter((s) => s.status === "generated" && Boolean(s.visualPrompt?.trim()));
}

function countProduction(
  scriptNodeId: string,
  beats: ScriptBeat[],
  shots: StoryboardShot[] | undefined,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): HermesProductionSnapshot {
  const readyShots = readyStoryboardShots(shots);
  const shotByBeat = new Map((shots ?? []).map((s) => [s.scriptBeatId, s]));
  const imageByBeat = findImageNodesForScript(scriptNodeId, nodes, edges);
  const failed = (shots ?? []).filter((s) => s.status === "failed").length;

  let imageReady = 0;
  let imageMissing = 0;
  let videoGenerated = 0;
  let videoFailed = 0;
  for (const shot of shots ?? []) {
    if (shot.videoStatus === "failed") videoFailed += 1;
  }

  for (const beat of beats) {
    const shot = shotByBeat.get(beat.id);
    const hasStoryboard =
      shot?.status === "generated" && Boolean(shot.visualPrompt?.trim());
    if (!hasStoryboard) continue;

    const imageNode = nodes.find((n) => n.id === imageByBeat.get(beat.id));
    if (shotHasGeneratedImage(beat.id, shot, imageNode)) imageReady += 1;
    else imageMissing += 1;

    if (shot.videoStatus === "generated") videoGenerated += 1;
  }

  const videoReadiness = assessBatchVideoReadiness({
    scriptNodeId,
    beats,
    shots,
    nodes,
    edges,
    scriptBeatSelection: undefined,
  });
  const videoEligible =
    "eligible" in videoReadiness ? videoReadiness.eligible.length : 0;
  const skip = "skipCounts" in videoReadiness ? videoReadiness.skipCounts : {};
  const videoMissing =
    (skip.no_image ?? 0) +
    (skip.no_video_node ?? 0) +
    (skip.no_prompt ?? 0) +
    (skip.storyboard_failed ?? 0) +
    (skip.no_draft_prompt ?? 0);

  const exportReadiness = assessComposeExportScope({
    scriptNodeId,
    beats,
    shots,
    nodes,
    edges,
    scriptBeatSelection: undefined,
  });
  const exportReady = "readyCount" in exportReadiness ? exportReadiness.readyCount : 0;
  const exportTotal = "totalInScope" in exportReadiness ? exportReadiness.totalInScope : 0;

  return {
    beatCount: beats.length,
    storyboardReady: readyShots.length,
    storyboardMissing: Math.max(0, beats.length - readyShots.length),
    storyboardFailed: failed,
    imageReady,
    imageMissing,
    videoGenerated,
    videoFailed,
    videoEligible,
    videoMissing,
    exportReady,
    exportTotal,
  };
}

function resolveSelection(
  nodes: Node<FlowNodeData>[],
  selectedNodeIds: string[] | undefined,
): HermesSelectionSnapshot {
  const ids = selectedNodeIds?.filter(Boolean) ?? [];
  if (ids.length === 0) return { mode: "none" };
  if (ids.length > 1) {
    return { mode: "multi" };
  }
  const node = nodes.find((n) => n.id === ids[0]);
  if (!node) return { mode: "none" };
  const beatId = beatIdFromNode(node.data);
  const script = findPrimaryScriptNode(nodes);
  const beats = normalizeScriptBeats(script?.data.scriptBeats);
  const beat = beatId ? beats.find((b) => b.id === beatId) : undefined;
  return {
    mode: "single",
    nodeId: node.id,
    label: node.data.label?.trim() || node.type || "节点",
    beatShotNumber: beat ? shotNumberLabel(beat) : undefined,
  };
}

function buildGaps(
  ctx: HermesCanvasContext,
  production: HermesProductionSnapshot,
  bible: ProjectBible | null,
): HermesSituationGap[] {
  const gaps: HermesSituationGap[] = [];

  if (!ctx.projectPath) {
    gaps.push({
      id: "no_project",
      severity: "block",
      message: "未打开工程，生成类操作不可用",
    });
    return gaps;
  }

  // 无限画布非线性编辑：无脚本节点是合法状态，不主动提示「缺脚本」
  if (!ctx.scriptNodeId) {
    return gaps;
  }

  if (production.beatCount === 0 && ctx.hasBrief) {
    gaps.push({
      id: "no_beats",
      severity: "warn",
      message: "镜头表为空",
      suggestedPrompt: "帮我根据梗概生成镜头表",
    });
  }

  if (production.storyboardMissing > 0) {
    gaps.push({
      id: "storyboard_missing",
      severity: "warn",
      message: `还缺 ${production.storyboardMissing} 镜分镜文案`,
      suggestedPrompt: "帮我把脚本生成分镜",
    });
  }

  if (production.storyboardFailed > 0) {
    gaps.push({
      id: "storyboard_failed",
      severity: "warn",
      message: `${production.storyboardFailed} 镜分镜生成失败，可重试`,
      suggestedPrompt: "帮我把失败镜头的分镜重新生成",
    });
  }

  if (production.imageMissing > 0) {
    gaps.push({
      id: "image_missing",
      severity: "warn",
      message: `还缺 ${production.imageMissing} 镜关键帧`,
      suggestedPrompt: "帮我把分镜出图",
    });
  }

  if (bible && bible.characters.length > 0 && bibleCharacterRefCount(bible) === 0) {
    gaps.push({
      id: "bible_no_refs",
      severity: "info",
      message: "角色库尚无默认参考图，可在镜头表上传或从镜头表同步",
      suggestedPrompt:
        "帮我梳理角色参考图：哪些角色还缺默认参考图，并给上传建议（不要直接改镜头表）",
    });
  }

  if (production.videoFailed > 0) {
    gaps.push({
      id: "video_failed",
      severity: "warn",
      message: `${production.videoFailed} 镜视频生成失败`,
      suggestedPrompt: "帮我把失败镜头的视频重新生成",
    });
  }

  if (production.exportReady > 0) {
    gaps.push({
      id: "export_ready",
      severity: "info",
      message: `${production.exportReady}/${production.exportTotal} 镜可导出成片`,
      suggestedPrompt: "帮我把脚本导出成片",
    });
  }

  for (const iss of detectProductionIssues(production, ctx)) {
    const mapped = productionIssueToGap(iss);
    if (!gaps.some((g) => g.id === mapped.id)) {
      gaps.push(mapped);
    }
  }

  return gaps.slice(0, 6);
}

function buildHeadline(
  ctx: HermesCanvasContext,
  production: HermesProductionSnapshot,
  gaps: HermesSituationGap[],
): string {
  const visibleGaps = filterGapsForSituationCard(gaps);
  const top = visibleGaps.find((g) => g.severity === "block" || g.severity === "warn");
  if (top) return top.message;

  if (!ctx.scriptNodeId) return "可按需搭建节点，或直接对话";
  if (production.beatCount === 0) {
    return ctx.hasBrief ? "梗概已就绪，可生成镜头表" : "脚本节点已就绪";
  }

  const parts: string[] = [];
  if (production.storyboardReady > 0) {
    parts.push(`${production.storyboardReady} 镜分镜就绪`);
  }
  if (production.imageReady > 0) {
    parts.push(`${production.imageReady} 镜已有图`);
  }
  if (production.videoGenerated > 0) {
    parts.push(`${production.videoGenerated} 镜已出视频`);
  }
  if (production.exportReady > 0) {
    parts.push(`可导出 ${production.exportReady} 镜`);
  }

  return parts.length > 0 ? parts.join("，") : "制片进度已同步";
}

const EMPTY_PRODUCTION: HermesProductionSnapshot = {
  beatCount: 0,
  storyboardReady: 0,
  storyboardMissing: 0,
  storyboardFailed: 0,
  imageReady: 0,
  imageMissing: 0,
  videoGenerated: 0,
  videoFailed: 0,
  videoEligible: 0,
  videoMissing: 0,
  exportReady: 0,
  exportTotal: 0,
};

export function buildHermesSituation(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  projectPath: string | null,
  opts?: { selectedNodeIds?: string[]; bible?: ProjectBible | null },
): HermesSituation {
  const ctx = buildHermesCanvasContext(nodes, projectPath);
  const stage = inferHermesCreativeStage(nodes, edges, projectPath);
  const selection = resolveSelection(nodes, opts?.selectedNodeIds);

  let production = EMPTY_PRODUCTION;
  if (ctx.scriptNodeId) {
    const script = findPrimaryScriptNode(nodes);
    const beats = normalizeScriptBeats(script?.data.scriptBeats);
    production = countProduction(
      ctx.scriptNodeId,
      beats,
      script?.data.storyboardShots,
      nodes,
      edges,
    );
  }

  const bible = opts?.bible ?? null;
  const gaps = buildGaps(ctx, production, bible);
  const headline = buildHeadline(ctx, production, gaps);

  return {
    ctx,
    stageId: stage.id,
    stageLabel: stage.label,
    production,
    gaps,
    selection,
    bible,
    headline,
  };
}

export type FormatHermesSituationOptions = {
  /** 为 false 时省略近期画布事件（由【工作记忆】单独提供，避免聊天重复） */
  includeCanvasEvents?: boolean;
  includeReferentHint?: boolean;
};

/** LLM / Director 用的结构化制片摘要 */
export function formatHermesSituationForLlm(
  situation: HermesSituation,
  opts?: FormatHermesSituationOptions,
): string {
  const { ctx, production, selection, stageLabel, gaps, bible } = situation;
  const lines: string[] = [
    formatHermesExpertDoctrineForLlm(),
    formatHermesGlobalUnderstandingForLlm(situation),
    formatHermesProjectProfileForLlm(inferHermesProductionProjectType(situation)),
    `创作阶段：${stageLabel}`,
    formatBibleForHermesContext(bible),
    ctx.scriptNodeId
      ? `脚本：有（${ctx.beatCount} 条镜头，分镜就绪 ${production.storyboardReady}）`
      : "脚本：无",
    ctx.hasBrief ? "梗概：已填写" : "梗概：未填写",
    ctx.projectPath ? "工程：已打开" : "工程：未打开",
    `关键帧：${production.imageReady} 就绪 / 缺 ${production.imageMissing}`,
    `视频：已出 ${production.videoGenerated} · 失败 ${production.videoFailed} · 可批量 ${production.videoEligible}`,
    `导出：${production.exportReady}/${production.exportTotal} 镜可导出`,
  ];

  if (selection.mode === "single" && selection.label) {
    const shot = selection.beatShotNumber ? ` · 镜 ${selection.beatShotNumber}` : "";
    lines.push(`选中：${selection.label}${shot}`);
  } else if (selection.mode === "multi") {
    lines.push("选中：多个节点");
  }

  if (gaps.length > 0) {
    lines.push(
      "待办：" +
        gaps.map((g) => g.message).join("；"),
    );
  }

  if (opts?.includeCanvasEvents !== false) {
    const canvasBlock = formatCachedCanvasEventsForPrompt();
    if (canvasBlock) lines.push(canvasBlock);
  }
  if (opts?.includeReferentHint !== false) {
    const hint = formatCanvasReferentForPrompt(
      getCachedHermesWorkstate()?.lastCanvasReferent,
    );
    if (hint) lines.push(hint);
    const styleHint = formatStyleAnchorForPrompt(
      getCachedHermesWorkstate()?.lastStyleAnchor,
    );
    if (styleHint) lines.push(styleHint);
    const versionHint = formatVersionStyleReferentForPrompt(
      getCachedHermesWorkstate()?.lastVersionStyleReferent,
    );
    if (versionHint) lines.push(versionHint);
  }

  return lines.join("\n");
}
