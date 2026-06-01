import type { Node } from "@xyflow/react";
import { buildHermesCanvasContext } from "@/lib/hermes/hermesCanvasContext";
import { buildDirectorPlan } from "@/lib/hermes/hermesPlanFromIntent";
import type {
  HermesDirectorPlan,
  HermesPlanExecutionState,
  HermesPlanStep,
  HermesStepRunStatus,
} from "@/lib/hermes/hermesDirectorTypes";
import { HERMES_JOB_CANCELLED_ERROR } from "@/lib/hermes/agent/hermesJobStore";
import { referentFromPlanBeatIds } from "@/lib/hermes/agent/hermesCanvasReferent";
import { persistCanvasReferent } from "@/lib/hermes/agent/hermesCanvasEventCache";
import { runHermesTool } from "@/lib/hermes/hermesTools/runHermesTool";
import { resolveHermesChatMediaPreview } from "@/lib/hermes/hermesChatMediaPreview";
import { useProjectStore } from "@/store/projectStore";
import { isTauri } from "@tauri-apps/api/core";
import type { Edge } from "@xyflow/react";
import { expandTemplateStepsInPlan } from "@/lib/hermes/hermesPlanTemplates";
import { fetchHermesLlmPlan } from "@/lib/hermes/hermesPlanLlm";
import { isPlanStepAllowed } from "@/lib/hermes/agent/hermesAgentSettings";
import { pickHermesLlmProvider } from "@/lib/hermes/pickHermesProvider";
import { applyLearnedAdaptationToPlan } from "@/lib/hermes/agent/hermesLearningAdaptation";
import { completePlanWithLogicalSteps } from "@/lib/hermes/hermesPlanReasoning";
import {
  listHermesRegisteredSkills,
} from "@/lib/hermes/agent/hermesSkillRegistry";
import { rankSkillsForMessage } from "@/lib/hermes/agent/hermesSkillMatching";
import { applySkillsToDirectorPlan } from "@/lib/hermes/agent/hermesSkillPlan";
import { consumePendingOrbPlanOrigin } from "@/lib/hermes/hermesOrbProactiveAct";
import { buildHermesSituation } from "@/lib/hermes/hermesSituation";
import { inferHermesProductionProjectType } from "@/lib/hermes/hermesProjectProfile";
import {
  hasHermesProductionIntent,
  wantsConversationOnly,
} from "@/lib/hermes/hermesConversationIntent";
import type { ProjectBible } from "@/lib/projectBible/projectBible";
import type { FlowNodeData } from "@/lib/types";

async function finalizeDirectorPlan(
  plan: HermesDirectorPlan | null,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  projectPath: string | null,
  userMessage: string,
  bible: ProjectBible | null = null,
): Promise<HermesDirectorPlan | null> {
  if (!plan) return null;

  const orbOrigin = consumePendingOrbPlanOrigin();
  let working = plan;
  if (orbOrigin) {
    working = {
      ...working,
      proactiveRecovery: true,
      orbSuggestionId: orbOrigin.suggestionId,
    };
  }

  const situation = buildHermesSituation(nodes, edges, projectPath);
  const projectType = inferHermesProductionProjectType(situation);
  const skills = await listHermesRegisteredSkills(projectPath);
  const ranked = rankSkillsForMessage(userMessage, skills, 3, { projectType });
  const skillPlan = applySkillsToDirectorPlan(working, userMessage, skills, ranked) ?? working;
  if (!skillPlan) return null;

  const expanded = expandTemplateStepsInPlan(skillPlan);
  const learned = await applyLearnedAdaptationToPlan(expanded, projectPath, userMessage);
  if (!learned) return null;
  return completePlanWithLogicalSteps(learned, nodes, edges, projectPath, bible);
}

const RETRYABLE_TOOLS = new Set<HermesPlanStep["toolId"]>([
  "image.generate_for_beats",
  "image.retry_failed",
  "video.generate_for_beats",
  "video.retry_failed",
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isWeakRulePlan(plan: HermesDirectorPlan | null): boolean {
  if (!plan) return true;
  if (plan.steps.length !== 1) return false;
  const only = plan.steps[0]!;
  if (only.toolId !== "canvas.summarize") return false;
  return only.label.includes("请先打开") || Boolean(only.args?.catalogOnly);
}

export type { HermesDirectorPlan, HermesPlanStep, HermesPlanExecutionState };
export { buildDirectorPlan } from "@/lib/hermes/hermesPlanFromIntent";
export { buildHermesCanvasContext } from "@/lib/hermes/hermesCanvasContext";
export { formatPlanStepsForChat } from "@/lib/hermes/hermesChatBrevity";
export {
  isLowRiskPlanStep,
  splitPlanForAutoRun,
  formatPlanAutoRunNote,
  formatPlanDirectorModeNote,
} from "@/lib/hermes/hermesLowRiskTools";
export {
  loadHermesDirectorPrefs,
  saveHermesDirectorPrefs,
  type HermesDirectorPrefs,
} from "@/lib/hermes/hermesDirectorPrefs";
export {
  expandTemplateStepsInPlan,
  formatTemplateCatalogForUser,
  instantiateTemplatePlan,
  listHermesPlanTemplates,
  planFromPendingSteps,
  resolveTemplateIdFromMessage,
} from "@/lib/hermes/hermesPlanTemplates";

export function proposeDirectorPlan(
  userMessage: string,
  nodes: Node<FlowNodeData>[],
  projectPath: string | null,
  opts?: { referenceRelPaths?: string[] },
): HermesDirectorPlan | null {
  const ctx = buildHermesCanvasContext(nodes, projectPath);
  return buildDirectorPlan(userMessage, ctx, opts);
}

/**
 * 混合规划：规则快路径优先；未命中时用 LLM 生成 JSON 计划。
 */
export async function proposeDirectorPlanAsync(
  userMessage: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  projectPath: string | null,
  opts?: {
    referenceRelPaths?: string[];
    messageMode?: "consult" | "execute" | "mixed";
  },
): Promise<HermesDirectorPlan | null> {
  const text = userMessage.trim();
  if (!text) return null;

  if (opts?.messageMode === "consult") return null;
  if (wantsConversationOnly(text) && !hasHermesProductionIntent(text)) return null;

  const ctx = buildHermesCanvasContext(nodes, projectPath);
  const rulePlan = buildDirectorPlan(text, ctx, opts);
  const ruleStrong = rulePlan && !isWeakRulePlan(rulePlan);

  if (ruleStrong) {
    return finalizeDirectorPlan(rulePlan, nodes, edges, projectPath, text);
  }

  if (!isTauri()) {
    return finalizeDirectorPlan(rulePlan, nodes, edges, projectPath, text);
  }

  const shouldTryLlm = !rulePlan || hasHermesProductionIntent(text);
  if (shouldTryLlm) {
    const provider = await pickHermesLlmProvider();
    if (provider) {
      try {
        const llmPlan = await fetchHermesLlmPlan({
          nodes,
          edges,
          userMessage: text,
          ctx,
          providerId: provider.providerId,
          model: provider.model,
          referenceRelPaths: opts?.referenceRelPaths,
          projectPath,
          messageMode: opts?.messageMode,
        });
        if (llmPlan) {
          return finalizeDirectorPlan(llmPlan, nodes, edges, projectPath, text);
        }
      } catch {
        /* fall through to rule plan */
      }
    }
  }

  return finalizeDirectorPlan(rulePlan, nodes, edges, projectPath, text);
}

export function initialExecutionState(plan: HermesDirectorPlan): HermesPlanExecutionState {
  const stepStatuses: Record<string, HermesStepRunStatus> = {};
  for (const s of plan.steps) {
    stepStatuses[s.id] = "pending";
  }
  return { planId: plan.id, stepStatuses, currentStepId: null, error: null };
}

export type ExecuteDirectorPlanCallbacks = {
  onStepStart?: (step: HermesPlanStep) => void;
  onStepEnd?: (
    step: HermesPlanStep,
    ok: boolean,
    message: string,
    preview?: import("@/lib/hermes/hermesChatMediaPreview").HermesChatMediaPreview,
  ) => void;
  onState?: (state: HermesPlanExecutionState) => void;
  /** 返回 true 时中止剩余步骤（如用户取消 Job） */
  shouldAbort?: () => boolean;
};

export type ExecuteDirectorPlanResult = {
  state: HermesPlanExecutionState;
  failedStep: HermesPlanStep | null;
};

export type ExecuteDirectorStepResult = {
  result: import("@/lib/hermes/hermesDirectorTypes").HermesToolRunResult;
  scriptNodeId: string | null;
  gateBlocked: boolean;
  gateReason?: string;
};

/** 执行单个计划步骤（含 gate、可重试工具一次） */
export async function executeDirectorStep(
  step: HermesPlanStep,
  plan: HermesDirectorPlan,
  scriptNodeId: string | null,
): Promise<ExecuteDirectorStepResult> {
  const gate = isPlanStepAllowed(step);
  if (!gate.allowed) {
    return {
      result: { ok: false, message: gate.reason ?? "步骤被设置禁止" },
      scriptNodeId,
      gateBlocked: true,
      gateReason: gate.reason,
    };
  }

  const stepRefPaths = Array.isArray(step.args?.referenceRelPaths)
    ? (step.args.referenceRelPaths as string[])
    : plan.referenceRelPaths;
  const runOnce = () =>
    runHermesTool(step, {
      sourceMessage: plan.sourceMessage,
      scriptNodeId,
      referenceRelPaths: stepRefPaths,
      directorStepId: step.id,
    });

  let result = await runOnce();

  if (!result.ok && RETRYABLE_TOOLS.has(step.toolId)) {
    await sleep(2000);
    result = await runOnce();
  }

  const nextScriptId = result.scriptNodeId ?? scriptNodeId;
  return { result, scriptNodeId: nextScriptId, gateBlocked: false };
}

/**
 * 按顺序执行计划；任一步失败则停止。
 */
export async function executeDirectorPlan(
  plan: HermesDirectorPlan,
  callbacks?: ExecuteDirectorPlanCallbacks,
): Promise<ExecuteDirectorPlanResult> {
  let state = initialExecutionState(plan);
  let scriptNodeId: string | null = null;
  let failedStep: HermesPlanStep | null = null;

  const pushState = (patch: Partial<HermesPlanExecutionState>) => {
    state = { ...state, ...patch };
    callbacks?.onState?.(state);
  };

  for (const step of plan.steps) {
    if (callbacks?.shouldAbort?.()) {
      pushState({ currentStepId: null, error: HERMES_JOB_CANCELLED_ERROR });
      return { state, failedStep: null };
    }

    pushState({
      currentStepId: step.id,
      stepStatuses: { ...state.stepStatuses, [step.id]: "running" },
    });
    callbacks?.onStepStart?.(step);

    const { result, scriptNodeId: nextScriptId, gateBlocked, gateReason } =
      await executeDirectorStep(step, plan, scriptNodeId);
    scriptNodeId = nextScriptId;

    if (result.ok) {
      const projectPath = useProjectStore.getState().projectPath?.trim();
      const referent = referentFromPlanBeatIds(step.args?.beatIds);
      if (projectPath && referent) {
        void persistCanvasReferent(projectPath, referent);
      }
    }

    const status: HermesStepRunStatus = result.ok ? "done" : "failed";
    pushState({
      stepStatuses: { ...state.stepStatuses, [step.id]: status },
      currentStepId: null,
      error: result.ok ? null : result.message,
    });
    callbacks?.onStepEnd?.(
      step,
      result.ok,
      gateBlocked ? (gateReason ?? result.message) : result.message,
      resolveHermesChatMediaPreview({
        toolId: step.toolId,
        ok: result.ok,
        message: result.message,
        explicit: result.mediaPreview,
      }),
    );

    if (!result.ok) {
      failedStep = step;
      break;
    }
  }

  return { state, failedStep };
}
