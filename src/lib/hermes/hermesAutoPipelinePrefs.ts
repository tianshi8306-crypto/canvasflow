import {
  loadHermesAgentSettingsSync,
  patchHermesAgentSettings,
} from "@/lib/hermes/agent/hermesAgentSettings";
import { HERMES_FULL_AUTO_TEMPLATE_ID } from "@/lib/hermes/hermesPlanTemplates";
import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";

export type HermesAutoPipelinePrefs = {
  /** 大批量出图/视频跳过对话「继续」确认 */
  skipBatchConfirm: boolean;
};

/** @deprecated iter-46 起并入 AppSettings agentAutoBatch */
export const HERMES_AUTO_PIPELINE_PREFS_KEY = "canvasflow.hermesAutoPipeline.v1";

export function defaultHermesAutoPipelinePrefs(): HermesAutoPipelinePrefs {
  return { skipBatchConfirm: true };
}

/** @deprecated 使用 loadHermesAgentSettingsSync().agentAutoBatch */
export function loadHermesAutoPipelinePrefs(): HermesAutoPipelinePrefs {
  return { skipBatchConfirm: loadHermesAgentSettingsSync().agentAutoBatch };
}

/** @deprecated 使用 patchHermesAgentSettings */
export function saveHermesAutoPipelinePrefs(prefs: HermesAutoPipelinePrefs): void {
  void patchHermesAgentSettings({ agentAutoBatch: prefs.skipBatchConfirm });
}

export function isFullAutoPipelinePlan(plan: HermesDirectorPlan): boolean {
  return plan.templateId === HERMES_FULL_AUTO_TEMPLATE_ID;
}

export function userMessageRequestsFullAuto(text: string): boolean {
  const t = text.trim();
  if (!t || /^(什么是|怎么|如何|为什么)/.test(t)) return false;
  return /全自动|无人值守|一键出片|从零到.*成片|自动跑完|跑完全片|端到端|一条龙|通宵跑/.test(
    t,
  );
}
