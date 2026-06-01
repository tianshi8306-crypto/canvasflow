import type { Node } from "@xyflow/react";
import {
  beatIdsForShotNumbers,
  parseShotNumbersFromMessage,
} from "@/lib/hermes/hermesCanvasContext";
import type { HermesToolId } from "@/lib/hermes/hermesDirectorTypes";
import type { HermesJob } from "@/lib/hermes/agent/hermesJobStore";
import { useHermesJobStore } from "@/lib/hermes/agent/hermesJobStore";
import {
  loadPlanningMessageQueue,
  removePlanningQueueItems,
} from "@/lib/hermes/agent/hermesPlanningMessageQueue";
import { resolveToolBeatIds } from "@/lib/hermes/hermesTools/toolBeatIds";
import { normalizeScriptBeats } from "@/lib/scriptBeatHelpers";
import type { FlowNodeData } from "@/lib/types";

export type HermesNlJobCancelMediaKind = "image" | "video" | "any";

export type HermesNlJobCancelScope = {
  mediaKind: HermesNlJobCancelMediaKind;
  /** 1-based 镜号；空数组表示不限镜号 */
  shotNumbers: number[];
};

export type HermesNlJobCancelTarget =
  | { kind: "director"; scope: HermesNlJobCancelScope; runningOnly?: boolean }
  | { kind: "planning_queue"; scope: "all" | HermesNlJobCancelScope }
  | { kind: "both"; scope: HermesNlJobCancelScope };

const IMAGE_TOOLS = new Set<HermesToolId>([
  "image.generate_for_beats",
  "image.retry_failed",
]);

const VIDEO_TOOLS = new Set<HermesToolId>([
  "video.generate_for_beats",
  "video.retry_failed",
]);

function hasCancelVerb(text: string): boolean {
  return /取消|停止|中止|停下|别.{0,8}了|不要.{0,8}了/.test(text);
}

function looksLikeConsultNotCancel(text: string): boolean {
  return /先聊|聊聊|问问|咨询|解释一下|有什么区别|科普/.test(text);
}

function inferMediaKind(text: string): HermesNlJobCancelMediaKind {
  if (/出图|关键帧|图片|出照片|分镜图/.test(text)) return "image";
  if (/出视频|视频生成|图生视频|seedance/i.test(text)) return "video";
  return "any";
}

function messageMentionsMediaKind(
  text: string,
  mediaKind: HermesNlJobCancelMediaKind,
): boolean {
  if (mediaKind === "image") {
    return /出图|关键帧|分镜图|图片/.test(text);
  }
  if (mediaKind === "video") {
    return /出视频|视频|seedance/i.test(text);
  }
  return true;
}

function shotNumbersOverlap(a: number[], b: number[]): boolean {
  if (a.length === 0 || b.length === 0) return true;
  const set = new Set(a);
  return b.some((n) => set.has(n));
}

function stepMatchesScope(
  step: { toolId: HermesToolId; args?: Record<string, unknown> },
  scope: HermesNlJobCancelScope,
  scriptNodeId: string | null,
  sourceMessage: string,
  nodes: Node<FlowNodeData>[],
): boolean {
  if (scope.mediaKind === "image" && !IMAGE_TOOLS.has(step.toolId)) return false;
  if (scope.mediaKind === "video" && !VIDEO_TOOLS.has(step.toolId)) return false;
  if (
    scope.mediaKind === "any" &&
    !IMAGE_TOOLS.has(step.toolId) &&
    !VIDEO_TOOLS.has(step.toolId)
  ) {
    return false;
  }

  if (scope.shotNumbers.length === 0) return true;

  if (scriptNodeId) {
    const beatIds = resolveToolBeatIds(
      scriptNodeId,
      step.args,
      sourceMessage,
      nodes,
    );
    const beats = normalizeScriptBeats(
      nodes.find((n) => n.id === scriptNodeId)?.data.scriptBeats,
    );
    const targetBeatIds = beatIdsForShotNumbers(beats, scope.shotNumbers);
    if (beatIds?.length && targetBeatIds.some((id) => beatIds.includes(id))) {
      return true;
    }
  }

  const msgNums = parseShotNumbersFromMessage(sourceMessage);
  return shotNumbersOverlap(scope.shotNumbers, msgNums);
}

export function directorJobMatchesCancelScope(
  job: HermesJob,
  scope: HermesNlJobCancelScope,
  scriptNodeId: string | null,
  nodes: Node<FlowNodeData>[],
  runningOnly = false,
): boolean {
  if (job.kind !== "director_plan") return false;
  if (runningOnly) {
    if (job.status !== "running") return false;
  } else if (job.status !== "queued" && job.status !== "running") {
    return false;
  }

  const plan = job.payload.plan;
  const titleHit =
    scope.shotNumbers.length > 0 &&
    shotNumbersOverlap(scope.shotNumbers, parseShotNumbersFromMessage(job.title));

  if (
    plan.steps.some((step) =>
      stepMatchesScope(step, scope, scriptNodeId, plan.sourceMessage, nodes),
    )
  ) {
    return true;
  }

  if (titleHit && messageMentionsMediaKind(job.title, scope.mediaKind)) {
    return true;
  }

  if (
    scope.shotNumbers.length > 0 &&
    shotNumbersOverlap(scope.shotNumbers, parseShotNumbersFromMessage(plan.sourceMessage)) &&
    messageMentionsMediaKind(plan.sourceMessage, scope.mediaKind)
  ) {
    return true;
  }

  return false;
}

export function planningQueueItemMatchesCancelScope(
  itemText: string,
  scope: HermesNlJobCancelScope,
): boolean {
  const text = itemText.trim();
  if (!text) return false;

  if (scope.shotNumbers.length === 0) {
    return messageMentionsMediaKind(text, scope.mediaKind);
  }

  const nums = parseShotNumbersFromMessage(text);
  if (!shotNumbersOverlap(scope.shotNumbers, nums)) return false;
  return messageMentionsMediaKind(text, scope.mediaKind);
}

/** 解析自然语言 Job 取消请求；null 表示非取消话术 */
export function parseHermesNlJobCancelRequest(
  text: string,
): HermesNlJobCancelTarget | null {
  const t = text.trim();
  if (!t || !hasCancelVerb(t)) return null;
  if (looksLikeConsultNotCancel(t)) return null;
  if (/脚本|版本|快照|回滚/.test(t)) return null;
  if (/取消全部排队|清空排队|取消排队任务/.test(t)) return null;

  if (/规划队列|规划后|规划完成/.test(t) && /取消|清空|停止/.test(t)) {
    return { kind: "planning_queue", scope: "all" };
  }

  if (/当前|正在执行|正在跑|这个任务|制片任务/.test(t) && /取消|停止/.test(t)) {
    return {
      kind: "director",
      scope: { mediaKind: "any", shotNumbers: [] },
      runningOnly: true,
    };
  }

  const shotNumbers = parseShotNumbersFromMessage(t);
  const mediaKind = inferMediaKind(t);

  if (/只取消视频|取消全部视频|取消所有视频|停止全部视频/.test(t)) {
    return {
      kind: "both",
      scope: { mediaKind: "video", shotNumbers: [] },
    };
  }
  if (/只取消出图|取消全部出图|取消所有出图|只取消图片|停止全部出图/.test(t)) {
    return {
      kind: "both",
      scope: { mediaKind: "image", shotNumbers: [] },
    };
  }

  if (/取消.*出图|停止.*出图|别出图|不要出图/.test(t) && shotNumbers.length === 0) {
    return {
      kind: "both",
      scope: { mediaKind: "image", shotNumbers: [] },
    };
  }
  if (/取消.*视频|停止.*视频|别出视频|不要出视频/.test(t) && shotNumbers.length === 0) {
    return {
      kind: "both",
      scope: { mediaKind: "video", shotNumbers: [] },
    };
  }

  if (shotNumbers.length > 0 || /全部|所有/.test(t)) {
    return {
      kind: "both",
      scope: { mediaKind, shotNumbers },
    };
  }

  return null;
}

export type HermesNlJobCancelResult = {
  directorCancelled: number;
  planningRemoved: number;
  message: string;
};

function formatScopeLabel(scope: HermesNlJobCancelScope): string {
  const shot =
    scope.shotNumbers.length === 0
      ? ""
      : `第 ${scope.shotNumbers.join("、")} 镜`;
  const media =
    scope.mediaKind === "image"
      ? "出图"
      : scope.mediaKind === "video"
        ? "视频"
        : "制片";
  return `${shot}${media}`.trim() || "匹配任务";
}

export function executeHermesNlJobCancel(
  target: HermesNlJobCancelTarget,
  ctx: {
    projectPath: string;
    scriptNodeId: string | null;
    nodes: Node<FlowNodeData>[];
  },
): HermesNlJobCancelResult {
  const { projectPath, scriptNodeId, nodes } = ctx;
  let directorCancelled = 0;
  let planningRemoved = 0;

  const cancelDirector = (scope: HermesNlJobCancelScope, runningOnly = false) => {
    const jobs = useHermesJobStore
      .getState()
      .jobs.filter(
        (j) =>
          j.projectPath === projectPath &&
          directorJobMatchesCancelScope(j, scope, scriptNodeId, nodes, runningOnly),
      );
    for (const job of jobs) {
      useHermesJobStore.getState().cancelJob(job.id);
      directorCancelled += 1;
    }
  };

  const cancelPlanning = (scope: HermesNlJobCancelScope | "all") => {
    if (scope === "all") {
      const n = loadPlanningMessageQueue(projectPath).length;
      if (n > 0) {
        planningRemoved = removePlanningQueueItems(projectPath, () => true);
      }
      return;
    }
    planningRemoved = removePlanningQueueItems(projectPath, (item) =>
      planningQueueItemMatchesCancelScope(item.text, scope),
    );
  };

  if (target.kind === "director") {
    cancelDirector(target.scope, target.runningOnly);
  } else if (target.kind === "planning_queue") {
    cancelPlanning(target.scope);
  } else {
    cancelDirector(target.scope);
    cancelPlanning(target.scope);
  }

  const parts: string[] = [];
  if (directorCancelled > 0) {
    parts.push(`已取消 ${directorCancelled} 个制片 Job`);
  }
  if (planningRemoved > 0) {
    parts.push(`已从规划队列移除 ${planningRemoved} 条`);
  }

  if (parts.length === 0) {
    if (target.kind === "planning_queue" && target.scope === "all") {
      return {
        directorCancelled: 0,
        planningRemoved: 0,
        message: "规划队列已是空的。",
      };
    }
    if (target.kind === "director" && target.runningOnly) {
      return {
        directorCancelled: 0,
        planningRemoved: 0,
        message: "当前没有正在执行的制片任务。",
      };
    }
    const label =
      target.kind === "planning_queue"
        ? "规划队列"
        : formatScopeLabel(
            target.kind === "director" ? target.scope : target.scope,
          );
    return {
      directorCancelled: 0,
      planningRemoved: 0,
      message: `未找到可取消的${label}任务。可说「制片队列」查看状态。`,
    };
  }

  return {
    directorCancelled,
    planningRemoved,
    message: `${parts.join("；")}。`,
  };
}
