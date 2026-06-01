import type { Edge, Node } from "@xyflow/react";
import {
  buildHermesCanvasContext,
  type HermesCanvasContext,
} from "@/lib/hermes/hermesCanvasContext";
import type {
  HermesDirectorPlan,
  HermesPlanExecutionState,
  HermesPlanStep,
  HermesStepRunStatus,
  HermesToolId,
} from "@/lib/hermes/hermesDirectorTypes";
import { resolveHermesChatMediaPreview } from "@/lib/hermes/hermesChatMediaPreview";
import {
  executeDirectorPlan,
  executeDirectorStep,
  initialExecutionState,
  type ExecuteDirectorPlanCallbacks,
  type ExecuteDirectorPlanResult,
} from "@/lib/hermes/hermesDirector";
import {
  buildHermesSituation,
  type HermesProductionSnapshot,
} from "@/lib/hermes/hermesSituation";
import { shouldUseAgentLoop } from "@/lib/hermes/agent/hermesAgentSettings";
import { HERMES_JOB_CANCELLED_ERROR } from "@/lib/hermes/agent/hermesJobStore";
import {
  preflightWorkflowRepairSteps,
  proposeRepairStepsAfterWorkflowCheck,
  proposeWorkflowAwareRecoverySteps,
} from "@/lib/hermes/hermesWorkflowRepair";
import { buildFilmWorkflowCheckReport } from "@/lib/hermes/film/filmWorkflowCheck";
import type { FlowNodeData } from "@/lib/types";
import type { ProjectBible } from "@/lib/projectBible/projectBible";

export const AGENT_LOOP_MAX_STEPS = 12;
export const AGENT_LOOP_MAX_REPLANS = 3;

export type AgentLoopLastToolResult = {
  ok: boolean;
  message: string;
  toolId: HermesToolId;
  label: string;
};

export type AgentLoopObserve = {
  canvas: HermesCanvasContext;
  production: HermesProductionSnapshot;
  lastToolResult?: AgentLoopLastToolResult;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  bible: ProjectBible | null;
};

export type AgentLoopReplanEvent = {
  steps: HermesPlanStep[];
  reason: string;
};

function makeStep(
  toolId: HermesToolId,
  label: string,
  args?: Record<string, unknown>,
): HermesPlanStep {
  return { id: crypto.randomUUID(), toolId, label, args };
}

function cloneArgs(step: HermesPlanStep): Record<string, unknown> | undefined {
  if (!step.args) return undefined;
  return { ...step.args };
}

/** 执行下一步前：按画布状态插入依赖步骤（规则型，不调用 LLM） */
export function preflightInjectedSteps(
  nextStep: HermesPlanStep,
  observe: AgentLoopObserve,
): HermesPlanStep[] {
  const p = observe.production;
  const ctx = observe.canvas;
  const injected: HermesPlanStep[] = [];

  const needsStoryboard =
    p.beatCount > 0 && p.storyboardReady < p.beatCount;

  if (nextStep.toolId === "image.generate_for_beats" && needsStoryboard) {
    if (!ctx.scriptNodeId) {
      injected.push(makeStep("canvas.ensure_script", "出图前创建脚本节点"));
    } else {
      injected.push(makeStep("script.generate_storyboard", "出图前补充分镜文案"));
    }
  }

  if (
    nextStep.toolId === "video.generate_for_beats" ||
    nextStep.toolId === "video.retry_failed"
  ) {
    if (needsStoryboard) {
      injected.push(makeStep("script.generate_storyboard", "出视频前补充分镜文案"));
    }
    if (p.imageMissing > 0 && p.storyboardReady > 0) {
      injected.push(
        makeStep(
          "image.generate_for_beats",
          "出视频前批量出关键帧",
          cloneArgs(nextStep),
        ),
      );
    }
  }

  if (nextStep.toolId === "film.shot_to_video_prompt" && needsStoryboard) {
    injected.push(makeStep("script.generate_storyboard", "写视频提示前先补分镜"));
  }

  const mediaTools = new Set<HermesToolId>([
    "image.generate_for_beats",
    "image.retry_failed",
    "video.generate_for_beats",
    "video.retry_failed",
  ]);
  if (p.storyboardFailed > 0 && mediaTools.has(nextStep.toolId)) {
    if (p.storyboardReady > 0) {
      injected.push(makeStep("image.retry_failed", "先重试失败关键帧"));
    } else {
      injected.push(makeStep("script.generate_storyboard", "先重试失败的分镜文案"));
    }
  }

  if (
    (nextStep.toolId === "video.generate_for_beats" ||
      nextStep.toolId === "video.retry_failed") &&
    p.videoFailed > 0
  ) {
    injected.push(makeStep("video.retry_failed", "先重试失败镜头的视频"));
  }

  return injected;
}

export function decideLoopRecoverySteps(
  failedStep: HermesPlanStep,
  errorMessage: string,
  parentPlan: HermesDirectorPlan,
  observe: AgentLoopObserve,
  replanCount: number,
): HermesPlanStep[] | null {
  if (replanCount >= AGENT_LOOP_MAX_REPLANS) return null;
  return proposeWorkflowAwareRecoverySteps(
    failedStep,
    errorMessage,
    parentPlan,
    observe.production,
    observe.canvas,
    {
      nodes: observe.nodes,
      edges: observe.edges,
      projectPath: observe.canvas.projectPath,
      bible: observe.bible,
    },
  );
}

export function buildAgentLoopObserve(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  projectPath: string | null,
  bible: ProjectBible | null,
  lastToolResult?: AgentLoopLastToolResult,
): AgentLoopObserve {
  const canvas = buildHermesCanvasContext(nodes, projectPath);
  const situation = buildHermesSituation(nodes, edges, projectPath, { bible });
  return {
    canvas,
    production: situation.production,
    lastToolResult,
    nodes,
    edges,
    bible: bible ?? null,
  };
}

export type ExecuteDirectorPlanWithLoopOpts = {
  callbacks?: ExecuteDirectorPlanCallbacks;
  getObserve: () => AgentLoopObserve;
  onReplan?: (event: AgentLoopReplanEvent) => void;
  onLoopRound?: (round: number, summary: string) => void;
  shouldAbort?: () => boolean;
};

function ensureStepInState(
  state: HermesPlanExecutionState,
  step: HermesPlanStep,
): HermesPlanExecutionState {
  if (state.stepStatuses[step.id]) return state;
  return {
    ...state,
    stepStatuses: { ...state.stepStatuses, [step.id]: "pending" },
  };
}

/**
 * Agent loop：动态队列 + 执行前 preflight + 失败后规则 recovery。
 * `agentLoopEnabled` 关时委托 `executeDirectorPlan`（固定计划）。
 */
export async function executeDirectorPlanWithAgentLoop(
  plan: HermesDirectorPlan,
  opts: ExecuteDirectorPlanWithLoopOpts,
): Promise<ExecuteDirectorPlanResult> {
  const shouldAbort = () =>
    Boolean(opts.shouldAbort?.() || opts.callbacks?.shouldAbort?.());

  if (!shouldUseAgentLoop()) {
    return executeDirectorPlan(plan, {
      ...opts.callbacks,
      shouldAbort: () => shouldAbort(),
    });
  }

  let state = initialExecutionState(plan);
  let scriptNodeId: string | null = null;
  let failedStep: HermesPlanStep | null = null;
  const queue: HermesPlanStep[] = [...plan.steps];
  let replanCount = 0;
  let loopRound = 0;
  let stepsExecuted = 0;

  const pushState = (patch: Partial<HermesPlanExecutionState>) => {
    state = { ...state, ...patch };
    opts.callbacks?.onState?.(state);
  };

  while (queue.length > 0 && stepsExecuted < AGENT_LOOP_MAX_STEPS) {
    if (shouldAbort()) {
      pushState({ currentStepId: null, error: HERMES_JOB_CANCELLED_ERROR });
      return { state, failedStep: null };
    }

    const next = queue.shift()!;
    const observe = opts.getObserve();

    const dependencyInject = preflightInjectedSteps(next, observe);
    const workflowInject = preflightWorkflowRepairSteps(
      next,
      observe.production,
      observe.canvas,
      observe.nodes,
      observe.edges,
      observe.bible,
    );
    const seenInject = new Set<HermesToolId>();
    const inject = [...dependencyInject, ...workflowInject].filter((s) => {
      if (seenInject.has(s.toolId)) return false;
      seenInject.add(s.toolId);
      return true;
    });
    if (inject.length > 0) {
      loopRound += 1;
      opts.onLoopRound?.(
        loopRound,
        `补齐依赖：${inject.map((s) => s.label).join(" → ")}`,
      );
      opts.onReplan?.({
        steps: inject,
        reason: "执行前根据画布状态补齐依赖步骤",
      });
      for (const s of inject) {
        state = ensureStepInState(state, s);
      }
      queue.unshift(next, ...[...inject].reverse());
      continue;
    }

    state = ensureStepInState(state, next);
    pushState({
      currentStepId: next.id,
      stepStatuses: { ...state.stepStatuses, [next.id]: "running" },
    });
    opts.callbacks?.onStepStart?.(next);

    const { result, scriptNodeId: nextScriptId, gateBlocked, gateReason } =
      await executeDirectorStep(next, plan, scriptNodeId);
    if (nextScriptId) scriptNodeId = nextScriptId;

    if (gateBlocked) {
      failedStep = next;
      pushState({
        stepStatuses: { ...state.stepStatuses, [next.id]: "failed" },
        currentStepId: null,
        error: gateReason ?? result.message,
      });
      opts.callbacks?.onStepEnd?.(
        next,
        false,
        gateReason ?? result.message,
        resolveHermesChatMediaPreview({
          toolId: next.toolId,
          ok: false,
          message: result.message,
          explicit: result.mediaPreview,
        }),
      );
      break;
    }

    const status: HermesStepRunStatus = result.ok ? "done" : "failed";
    pushState({
      stepStatuses: { ...state.stepStatuses, [next.id]: status },
      currentStepId: null,
      error: result.ok ? null : result.message,
    });
    opts.callbacks?.onStepEnd?.(
      next,
      result.ok,
      result.message,
      resolveHermesChatMediaPreview({
        toolId: next.toolId,
        ok: result.ok,
        message: result.message,
        explicit: result.mediaPreview,
      }),
    );
    stepsExecuted += 1;
    loopRound += 1;
    opts.onLoopRound?.(
      loopRound,
      `${next.label}：${result.message.slice(0, 120)}`,
    );

    if (
      result.ok &&
      next.toolId === "film.workflow_check" &&
      next.args?.autoRepair !== false
    ) {
      const report = buildFilmWorkflowCheckReport({
        nodes: observe.nodes,
        edges: observe.edges,
        projectPath: observe.canvas.projectPath,
        bible: observe.bible,
      });
      const repair = proposeRepairStepsAfterWorkflowCheck(
        report,
        observe.production,
        observe.canvas,
      );
      if (repair.length > 0) {
        replanCount += 1;
        opts.onReplan?.({
          steps: repair,
          reason: `流程检查发现 ${report.blockers} 项待办、${report.warnings} 项待完善，自动修复`,
        });
        for (const s of repair) {
          state = ensureStepInState(state, s);
        }
        queue.unshift(...[...repair].reverse());
        continue;
      }
    }

    if (!result.ok) {
      failedStep = next;
      const recovery = decideLoopRecoverySteps(
        next,
        result.message,
        plan,
        {
          ...observe,
          lastToolResult: {
            ok: false,
            message: result.message,
            toolId: next.toolId,
            label: next.label,
          },
        },
        replanCount,
      );
      if (recovery && recovery.length > 0) {
        replanCount += 1;
        opts.onReplan?.({
          steps: recovery,
          reason: `步骤失败，尝试修复（${replanCount}/${AGENT_LOOP_MAX_REPLANS}）`,
        });
        for (const s of recovery) {
          state = ensureStepInState(state, s);
        }
        queue.unshift(...[...recovery].reverse());
        pushState({ error: null });
        failedStep = null;
        continue;
      }
      break;
    }
  }

  if (queue.length > 0 && !state.error && stepsExecuted >= AGENT_LOOP_MAX_STEPS) {
    pushState({
      error: `已达步数上限（${AGENT_LOOP_MAX_STEPS}），剩余 ${queue.length} 步未执行`,
    });
  }

  return { state, failedStep };
}
