import {
  loadHermesAgentSettingsSync,
  patchHermesAgentSettings,
} from "@/lib/hermes/agent/hermesAgentSettings";
import {
  formatCheckpointStatus,
  loadPipelineCheckpoint,
  planFromPipelineCheckpoint,
} from "@/lib/hermes/hermesPipelineCheckpoint";
import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";

export type HermesAutoPipelineChatIntent =
  | "enable_skip_confirm"
  | "disable_skip_confirm"
  | "show_prefs"
  | "resume_pipeline"
  | "show_checkpoint";

export function resolveAutoPipelineChatIntent(
  text: string,
): HermesAutoPipelineChatIntent | null {
  const t = text.trim();
  if (!t) return null;
  if (/^(开启|打开|启用).*(全自动|免确认|批量确认)/.test(t)) {
    return "enable_skip_confirm";
  }
  if (/^(关闭|停用).*(全自动|免确认|批量确认)/.test(t)) {
    return "disable_skip_confirm";
  }
  if (/全自动.*(设置|状态|怎么)/.test(t)) return "show_prefs";
  if (/^(继续跑片|断点续跑|接着跑|继续执行|续跑)/.test(t)) return "resume_pipeline";
  if (/跑片进度|断点|续跑.*哪/.test(t)) return "show_checkpoint";
  return null;
}

export function messageForAutoPipelineChatIntent(
  intent: HermesAutoPipelineChatIntent,
  projectPath: string | null,
): { message: string; planToRun?: HermesDirectorPlan } {
  const prefs = loadHermesAgentSettingsSync();
  if (intent === "enable_skip_confirm") {
    void patchHermesAgentSettings({ agentAutoBatch: true });
    return {
      message:
        "已开启：大批量出图/视频默认不再询问「继续」。可在 **设置 → Agent** 调整。",
    };
  }
  if (intent === "disable_skip_confirm") {
    void patchHermesAgentSettings({ agentAutoBatch: false });
    return {
      message:
        "已关闭大批量免确认：≥4 镜批量前会请你回复「继续」。可在 **设置 → Agent** 调整。",
    };
  }
  if (intent === "show_prefs") {
    return {
      message: `Agent 设置：自动执行 = ${prefs.agentAutoExecute ? "开" : "关"}；步内智能调整 = ${prefs.agentLoopEnabled ? "开" : "关"}；大批量免确认 = ${prefs.agentAutoBatch ? "开" : "关"}。\n请打开 **设置 → Agent**。`,
    };
  }
  const cp = loadPipelineCheckpoint(projectPath);
  if (intent === "show_checkpoint") {
    if (!cp) {
      return { message: "当前工程没有保存的跑片断点。" };
    }
    return { message: formatCheckpointStatus(cp) };
  }
  if (intent === "resume_pipeline") {
    if (!cp) {
      return { message: "没有可续跑的断点。可说「全自动跑片」从头开始。" };
    }
    const plan = planFromPipelineCheckpoint(cp);
    if (!plan) {
      return { message: "断点对应计划已全部完成，无需续跑。" };
    }
    return {
      message: `${formatCheckpointStatus(cp)}\n\n将从下一步自动执行…`,
      planToRun: plan,
    };
  }
  return { message: "" };
}
