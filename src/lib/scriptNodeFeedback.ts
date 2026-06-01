import type { NodeStatus } from "@/lib/types";

export const SCRIPT_PARSE_ZERO_BEATS_STATUS =
  "解析完成但未生成镜头：请补充更具体的剧情与镜头要求";

export const SCRIPT_PARSE_ZERO_BEATS_DETAIL =
  "解析完成但未生成镜头。建议：① 在底栏补充场次/角色/景别等约束；② 打开侧栏「运行」面板查看 script_parse 事件；③ 确认 API Key 与模型可用后点「重新解析」。";

export const SCRIPT_RUN_LOG_HINT = "可打开侧栏「运行」面板，筛选 script_parse 相关事件查看详情。";

export type ScriptNodeFeedbackTone = "error" | "warn" | "info";

export type ScriptNodeFeedback = {
  tone: ScriptNodeFeedbackTone;
  message: string;
};

/** 顶栏/底栏/全屏是否应显示为忙碌（与 isGraphRunning、节点 status 对齐） */
export function isScriptNodeTaskBusy(args: {
  isGraphRunning: boolean;
  status?: NodeStatus;
}): boolean {
  if (args.isGraphRunning) return true;
  const s = args.status?.status;
  return s === "running" || s === "pending";
}

export function isScriptStoryboardAgentBusy(status?: NodeStatus): boolean {
  if (!status) return false;
  const s = status.status;
  if (s !== "running" && s !== "pending") return false;
  const agent = status.agentName ?? "";
  return agent.includes("分镜");
}

export function scriptParseCompleteStatus(beatCount: number): string {
  return beatCount > 0
    ? `AI 解析完成：共 ${beatCount} 条镜头`
    : SCRIPT_PARSE_ZERO_BEATS_STATUS;
}

/** 底栏/全屏内嵌提示条（失败优先；解析后 0 条为 warn） */
export function resolveScriptNodePanelFeedback(args: {
  status?: NodeStatus;
  isGraphRunning: boolean;
  beatCount: number;
  themeFilled: boolean;
  zeroBeatsAfterParse?: boolean;
}): ScriptNodeFeedback | null {
  if (args.isGraphRunning) {
    return {
      tone: "info",
      message: "脚本任务执行中… 完成后将更新镜头表与状态栏。",
    };
  }

  if (args.status?.status === "failed") {
    const err = (args.status.error ?? "").trim() || "脚本或分镜任务失败";
    return {
      tone: "error",
      message: `${err}。${SCRIPT_RUN_LOG_HINT}`,
    };
  }

  if (args.zeroBeatsAfterParse && args.themeFilled && args.beatCount === 0) {
    return { tone: "warn", message: SCRIPT_PARSE_ZERO_BEATS_DETAIL };
  }

  return null;
}
