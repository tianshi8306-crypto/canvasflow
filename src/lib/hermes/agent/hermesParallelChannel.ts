import type { HermesMessageMode } from "@/lib/hermes/hermesMessageIntent";
import { shouldRunDirectorPlan } from "@/lib/hermes/hermesMessageIntent";

/** 咨询通道：不跑 director_plan，可与制片 Job 并行 */
export function isHermesConsultChannel(mode: HermesMessageMode): boolean {
  return mode === "consult";
}

/** 制片通道：规划 + 入队执行 */
export function isHermesProductionChannel(mode: HermesMessageMode): boolean {
  return shouldRunDirectorPlan(mode);
}

/**
 * R5：是否允许发送本条 Hermes 消息。
 * - 咨询：可与 streaming / 制片 Job 并行
 * - 执行 / 混合：可与 streaming 并行（Job 入队）；规划中走 planning queue（iter-113）
 */
export function canSubmitHermesMessage(opts: {
  messageMode: HermesMessageMode;
  streaming: boolean;
  planning: boolean;
}): boolean {
  void opts.streaming;
  void opts.planning;
  if (isHermesConsultChannel(opts.messageMode)) return true;
  if (isHermesProductionChannel(opts.messageMode)) return true;
  return true;
}

export function hermesParallelStatusHint(opts: {
  directorJobsRunning: number;
  directorJobsQueued: number;
  streaming: boolean;
  planning: boolean;
}): string | null {
  const parts: string[] = [];
  if (opts.directorJobsRunning > 0) {
    parts.push(
      opts.directorJobsQueued > 0
        ? `制片 ${opts.directorJobsRunning} 路执行中，${opts.directorJobsQueued} 路排队`
        : "制片任务执行中",
    );
  } else if (opts.directorJobsQueued > 0) {
    parts.push(`${opts.directorJobsQueued} 个制片任务排队`);
  }
  if (opts.streaming) parts.push("对话生成中");
  if (opts.planning) parts.push("规划制片步骤");
  if (parts.length < 2) return null;
  return `${parts.join(" · ")}（可并行）`;
}
