import type {
  HermesProductionSnapshot,
  HermesSituation,
  HermesSituationGap,
} from "@/lib/hermes/hermesSituation";
import type { HermesPipelineCheckpoint } from "@/lib/hermes/hermesPipelineCheckpoint";
import type { HermesCanvasEvent } from "@/lib/hermes/agent/hermesCanvasEvents";
import { shotEditedWithImageEvent, shotEditedWithVideoEvent } from "@/lib/hermes/agent/hermesCanvasEvents";
import type { HermesOrbSuggestion } from "@/lib/hermes/hermesOrbSuggestions.types";
import { countSparseVisualPrompts } from "@/lib/hermes/hermesPlanReasoning";
import { detectProductionIssues } from "@/lib/hermes/hermesProductionIssues";
import {
  isGapProactiveEligible,
  isProactiveSuggestionEligible,
  shouldSuggestWorkflowAutoRepair,
} from "@/lib/hermes/hermesProactivePolicy";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";

export type HermesProactiveSuggestion = HermesOrbSuggestion & {
  priority: number;
};

function item(
  priority: number,
  id: string,
  severity: HermesProactiveSuggestion["severity"],
  message: string,
  actionLabel: string,
  actionPrompt: string,
): HermesProactiveSuggestion {
  return { priority, id, severity, message, actionLabel, actionPrompt };
}

const GAP_ROOT_IDS = new Set([
  "no_project",
  "no_beats",
  "storyboard_missing",
  "storyboard_failed",
  "image_missing",
  "bible_no_refs",
  "video_failed",
  "video_ready_batch",
  "video_blocked",
  "export_ready",
  "export_not_ready",
]);

/** gap.id → 侧栏/Orb 建议 id（与 build 内规则一致） */
export function proactiveSuggestionIdForGap(gapId: string): string {
  if (gapId === "video_failed" || gapId === "storyboard_failed") return gapId;
  return `gap_${gapId}`;
}

/** 忽略建议时同步 gap_ 前缀与裸 id，避免 Situation 与芯片各显一条 */
export function expandProactiveDismissIds(id: string): string[] {
  const out = new Set<string>([id]);
  if (id.startsWith("gap_")) {
    out.add(id.slice(4));
  } else if (GAP_ROOT_IDS.has(id)) {
    out.add(`gap_${id}`);
  }
  if (id === "image_missing") out.add("gap_image_missing");
  if (id === "gap_image_missing") out.add("image_missing");
  if (id === "video_eligible") out.add("gap_video_ready_batch");
  if (id === "gap_video_ready_batch") out.add("video_eligible");
  return [...out];
}

export function isProactiveSuggestionDismissed(
  id: string,
  dismissedIds: ReadonlySet<string>,
): boolean {
  return expandProactiveDismissIds(id).some((x) => dismissedIds.has(x));
}

/** Situation 待办已展示时，侧栏芯片去掉同源 gap，只保留跃迁/E4/画布等增量建议 */
export function filterSidebarProactiveChips(
  suggestions: HermesProactiveSuggestion[],
  situationGaps: HermesSituationGap[],
  showSituationCard: boolean,
): HermesProactiveSuggestion[] {
  if (!showSituationCard || situationGaps.length === 0) return suggestions;

  const gapSuggestionIds = new Set(
    situationGaps.map((g) => proactiveSuggestionIdForGap(g.id)),
  );
  const gapPrompts = new Set(
    situationGaps
      .map((g) => g.suggestedPrompt?.trim())
      .filter((p): p is string => Boolean(p)),
  );

  return suggestions.filter((s) => {
    if (gapSuggestionIds.has(s.id)) return false;
    if (s.id.startsWith("gap_") && gapSuggestionIds.has(s.id)) return false;
    if (gapPrompts.has(s.actionPrompt.trim())) return false;
    return true;
  });
}

function gapActionLabel(gapId: string): string {
  if (gapId === "storyboard_missing") return "生成分镜";
  if (gapId === "image_missing") return "批量出图";
  if (gapId === "video_failed") return "重试视频";
  if (gapId === "no_beats") return "生成镜头表";
  if (gapId === "export_ready") return "导出成片";
  if (gapId === "video_blocked") return "建链出视频";
  if (gapId === "bible_no_refs") return "梳理参考图";
  if (gapId === "export_not_ready") return "导出顾问";
  return "执行";
}

/** 从 situation + 任务/画布信号生成排序后的主动补全建议（最多 max 条） */
export function buildHermesProactiveSuggestions(opts: {
  situation: HermesSituation;
  failedTaskCount: number;
  prevFingerprint?: string | null;
  recentCanvasEvents?: HermesCanvasEvent[];
  nodes?: Node<FlowNodeData>[];
  edges?: Edge[];
  pipelineCheckpoint?: HermesPipelineCheckpoint | null;
  directorJobsQueued?: number;
  /** 主脚本节点上的版本快照数量（≥2 时建议对比） */
  scriptVersionCount?: number;
  max?: number;
}): HermesProactiveSuggestion[] {
  const {
    situation,
    failedTaskCount,
    prevFingerprint = null,
    recentCanvasEvents = [],
    nodes = [],
    edges = [],
    pipelineCheckpoint = null,
    directorJobsQueued = 0,
    scriptVersionCount = 0,
    max = 4,
  } = opts;
  const p = situation.production;
  const prev = prevFingerprint ? parseProductionFingerprint(prevFingerprint) : null;
  const out: HermesProactiveSuggestion[] = [];

  if (!situation.ctx.projectPath) return out;

  if (scriptVersionCount >= 2) {
    out.push(
      item(
        38,
        "script_version_compare",
        "info",
        `已有 ${scriptVersionCount} 个脚本快照，可查看最近改动`,
        "版本对比",
        "版本对比",
      ),
    );
  }

  if (
    pipelineCheckpoint &&
    pipelineCheckpoint.completedStepCount < pipelineCheckpoint.plan.steps.length
  ) {
    const total = pipelineCheckpoint.plan.steps.length;
    const done = pipelineCheckpoint.completedStepCount;
    out.push(
      item(
        12,
        "pipeline_checkpoint_resume",
        "info",
        `制片计划未完成（${done}/${total} 步）`,
        "继续跑片",
        "继续跑片",
      ),
    );
  }

  if (failedTaskCount > 0) {
    out.push(
      item(
        5,
        "agent_tasks_failed",
        "warn",
        `${failedTaskCount} 个后台生成任务失败`,
        "检查并重试",
        "帮我检查刚才失败的任务，并给出重试建议",
      ),
    );
  }

  for (const gap of situation.gaps) {
    if (!gap.suggestedPrompt?.trim() || !isGapProactiveEligible(gap.id)) continue;
    const sev = gap.severity === "block" ? "warn" : gap.severity;
    let priority =
      gap.severity === "block" ? 10 : gap.severity === "warn" ? 30 : 50;
    if (gap.id === "video_failed") priority = 26;
    if (gap.id === "storyboard_failed") priority = 28;
    if (gap.id === "storyboard_missing") priority = 29;
    out.push(
      item(
        priority,
        proactiveSuggestionIdForGap(gap.id),
        sev,
        gap.message,
        gapActionLabel(gap.id),
        gap.suggestedPrompt.trim(),
      ),
    );
  }

  const recentEdit = [...recentCanvasEvents]
    .reverse()
    .find((e) => e.kind === "storyboard_edited");
  if (recentEdit && nodes.length > 0 && shotEditedWithImageEvent(recentEdit, nodes, edges)) {
    const shot = recentEdit.shotNumber ?? "该镜";
    out.push(
      item(
        35,
        "shot_edited_regen_image",
        "info",
        `镜 ${shot} 分镜已改，关键帧可能过时`,
        "重新出图",
        `帮我把镜 ${shot} 按新分镜重新出图`,
      ),
    );
  }

  if (recentEdit && nodes.length > 0 && shotEditedWithVideoEvent(recentEdit, nodes, edges)) {
    const shot = recentEdit.shotNumber ?? "该镜";
    out.push(
      item(
        36,
        "shot_edited_regen_video",
        "info",
        `镜 ${shot} 分镜已改，成片视频可能过时`,
        "重新出视频",
        `帮我把镜 ${shot} 按新分镜重新出视频`,
      ),
    );
  }

  const recentBrief = [...recentCanvasEvents]
    .reverse()
    .find((e) => e.kind === "brief_updated");
  if (recentBrief) {
    out.push(
      item(
        37,
        "brief_updated_sync",
        "info",
        "脚本梗概刚更新，分镜可能需要对齐",
        "检查分镜",
        "帮我根据最新梗概检查分镜是否需要调整",
      ),
    );
  }

  const storyboardJustComplete =
    prev &&
    prev.storyboardMissing > 0 &&
    p.storyboardReady === p.beatCount &&
    p.beatCount > 0 &&
    p.imageMissing > 0;

  if (storyboardJustComplete) {
    out.push(
      item(
        22,
        "storyboard_complete_chain",
        "success",
        "分镜已全部就绪，可以建链出图了",
        "建链并出图",
        "帮我一键建链（图+视频）并出图",
      ),
    );
  }

  const imagesJustFilled =
    prev &&
    prev.imageMissing > 0 &&
    p.imageMissing === 0 &&
    p.imageReady > 0 &&
    p.videoEligible > 0 &&
    p.videoGenerated < p.imageReady;

  if (imagesJustFilled) {
    out.push(
      item(
        24,
        "images_ready_video",
        "success",
        `关键帧已齐（${p.imageReady} 镜），可批量出视频`,
        "批量出视频",
        "帮我把分镜出视频",
      ),
    );
  }

  if (directorJobsQueued >= 2) {
    out.push(
      item(
        68,
        "director_jobs_queued",
        "info",
        `${directorJobsQueued} 个制片任务排队中`,
        "查看进度",
        "帮我说明当前制片任务进度与预计顺序",
      ),
    );
  }

  const sparseVisuals = countSparseVisualPrompts(nodes);
  if (sparseVisuals >= 3) {
    out.push(
      item(
        44,
        "optimize_sparse_visuals",
        "info",
        `${sparseVisuals} 镜分镜缺画面描述`,
        "顾问补全",
        "帮我检查哪些镜头缺少画面描述，并给补写建议（不要直接改分镜）",
      ),
    );
  }

  if (p.beatCount >= 12 && p.beatCount < 18) {
    out.push(
      item(
        46,
        "optimize_beat_pacing",
        "info",
        `当前 ${p.beatCount} 镜，可审视节奏与时长分配`,
        "节奏顾问",
        "帮我从短剧节奏角度审视镜头表，给合并/拉长建议（不要直接改稿）",
      ),
    );
  }

  const productionIssues = detectProductionIssues(p, situation.ctx);
  if (
    shouldSuggestWorkflowAutoRepair(productionIssues.map((i) => i.id)) &&
    !out.some((s) => s.id === "gap_video_failed")
  ) {
    out.push(
      item(
        38,
        "workflow_auto_repair",
        "warn",
        "检测到制片断链，可一键检查并修复",
        "检查并修复",
        "流程检查并修复",
      ),
    );
  }

  // E4：节奏 / 镜数 / 提示词优化（顾问向，不自动改稿）
  if (p.beatCount >= 18) {
    out.push(
      item(
        45,
        "optimize_shot_count",
        "info",
        `当前 ${p.beatCount} 镜，短剧节奏可能偏密`,
        "顾问精简",
        "帮我看看镜头表是否过长，给精简与节奏建议（不要直接改分镜）",
      ),
    );
  }

  const seenPrompt = new Set<string>();
  const deduped = out
    .sort((a, b) => a.priority - b.priority)
    .filter((s) => {
      if (!isProactiveSuggestionEligible(s.id)) return false;
      const key = s.actionPrompt.trim();
      if (seenPrompt.has(key)) return false;
      seenPrompt.add(key);
      return true;
    });

  return deduped.slice(0, max);
}

function parseProductionFingerprint(fp: string): HermesProductionSnapshot | null {
  const parts = fp.split(":").map((x) => parseInt(x, 10));
  if (parts.length < 9 || parts.some((n) => !Number.isFinite(n))) return null;
  return {
    beatCount: parts[0]!,
    storyboardReady: parts[1]!,
    storyboardMissing: parts[2]!,
    storyboardFailed: parts[3]!,
    imageReady: parts[4]!,
    imageMissing: parts[5]!,
    videoGenerated: parts[6]!,
    videoFailed: parts[7]!,
    videoEligible: parts[8]!,
    videoMissing: 0,
    exportReady: 0,
    exportTotal: 0,
  };
}

/** Orb 单条：取最高优先级且未 dismiss 的建议 */
export function pickHermesOrbSuggestionFromList(
  suggestions: HermesProactiveSuggestion[],
  dismissedIds: ReadonlySet<string>,
): HermesOrbSuggestion | null {
  const hit = suggestions.find((s) => !isProactiveSuggestionDismissed(s.id, dismissedIds));
  return hit ?? null;
}

export function pickHermesOrbSuggestion(opts: Parameters<
  typeof buildHermesProactiveSuggestions
>[0] & {
  dismissedIds: ReadonlySet<string>;
}): HermesOrbSuggestion | null {
  const list = buildHermesProactiveSuggestions({
    ...opts,
    prevFingerprint: opts.prevFingerprint ?? null,
    max: 6,
  });
  return pickHermesOrbSuggestionFromList(list, opts.dismissedIds);
}
