import type { HermesDirectorPlan, HermesPlanStep, HermesToolId } from "@/lib/hermes/hermesDirectorTypes";
import type { PatchStoryboardShotArgs } from "@/lib/hermes/hermesTools/patchStoryboardShotTool";

/** 始终视为低风险的 Director 工具（不产生图/视频任务） */
const ALWAYS_LOW_RISK_TOOLS = new Set<HermesToolId>([
  "canvas.add_text_node",
  "canvas.ensure_script",
  "canvas.focus",
  "canvas.summarize",
  "bible.update",
  "script.update_brief",
]);

export function isLowRiskPlanStep(step: HermesPlanStep): boolean {
  if (ALWAYS_LOW_RISK_TOOLS.has(step.toolId)) {
    return true;
  }
  if (step.toolId === "canvas.summarize" || step.toolId === "film.workflow_check") {
    return true;
  }
  if (step.toolId === "storyboard.patch_shot") {
    const args = step.args as PatchStoryboardShotArgs | undefined;
    return !args?.regenerateImage && !args?.regenerateVideo;
  }
  return false;
}

export type PlanAutoRunSplit = {
  autoPrefix: HermesPlanStep[];
  remainder: HermesPlanStep[];
};

/**
 * 从计划头部连续取出可自动执行的低风险步骤（需设置页开启 autoRunLowRisk）。
 */
export function splitPlanForAutoRun(
  plan: HermesDirectorPlan,
  autoRunEnabled: boolean,
): PlanAutoRunSplit {
  if (!autoRunEnabled || plan.steps.length === 0) {
    return { autoPrefix: [], remainder: plan.steps };
  }

  const autoPrefix: HermesPlanStep[] = [];
  let i = 0;
  for (; i < plan.steps.length; i++) {
    const step = plan.steps[i]!;
    if (!isLowRiskPlanStep(step)) break;
    autoPrefix.push(step);
  }
  return {
    autoPrefix,
    remainder: plan.steps.slice(i),
  };
}

export function formatPlanAutoRunNote(autoCount: number, remainderCount: number): string {
  if (autoCount <= 0) return "";
  if (remainderCount <= 0) {
    return "\n\n以上步骤均为低风险，将**自动执行**（可在设置 → Agent 关闭）。";
  }
  return `\n\n前 ${autoCount} 步为低风险，将**自动执行**；其余 ${remainderCount} 步请确认后执行。`;
}

export function formatPlanDirectorModeNote(): string {
  return "\n\n已开启**导演模式**，将自动执行全部步骤（设置 → Agent → 执行行为）。";
}
