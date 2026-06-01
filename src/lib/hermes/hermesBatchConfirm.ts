import {
  isFullAutoPipelinePlan,
  userMessageRequestsFullAuto,
} from "@/lib/hermes/hermesAutoPipelinePrefs";
import { shouldSkipBatchConfirm } from "@/lib/hermes/agent/hermesAgentSettings";
import type { HermesCanvasContext } from "@/lib/hermes/hermesCanvasContext";
import type { HermesDirectorPlan, HermesPlanStep } from "@/lib/hermes/hermesDirectorTypes";

const BATCH_TOOLS = new Set<HermesPlanStep["toolId"]>([
  "image.generate_for_beats",
  "video.generate_for_beats",
]);

/** 超过该镜数批量出图/视频前，需在对话里确认 */
export const HERMES_BATCH_CONFIRM_BEAT_THRESHOLD = 4;

function beatIdsFromStep(step: HermesPlanStep, ctx: HermesCanvasContext): number {
  const raw = step.args?.beatIds;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter((n) => typeof n === "number" && n >= 1).length;
  }
  if (ctx.storyboardReadyCount > 0) return ctx.storyboardReadyCount;
  if (ctx.beatCount > 0) return ctx.beatCount;
  return 0;
}

export function estimatePlanBatchBeatCount(
  plan: HermesDirectorPlan,
  ctx: HermesCanvasContext,
): number {
  let max = 0;
  for (const step of plan.steps) {
    if (!BATCH_TOOLS.has(step.toolId)) continue;
    max = Math.max(max, beatIdsFromStep(step, ctx));
  }
  return max;
}

export function shouldSkipBatchConfirmation(
  plan: HermesDirectorPlan,
  userMessage?: string,
): boolean {
  if (shouldSkipBatchConfirm()) return true;
  if (isFullAutoPipelinePlan(plan)) return true;
  if (userMessage && userMessageRequestsFullAuto(userMessage)) return true;
  return false;
}

export function planNeedsBatchConfirmation(
  plan: HermesDirectorPlan,
  ctx: HermesCanvasContext,
  opts?: { userMessage?: string },
): { needed: boolean; beatCount: number; labels: string[] } {
  if (shouldSkipBatchConfirmation(plan, opts?.userMessage)) {
    return { needed: false, beatCount: 0, labels: [] };
  }
  const labels: string[] = [];
  let beatCount = 0;
  for (const step of plan.steps) {
    if (!BATCH_TOOLS.has(step.toolId)) continue;
    const n = beatIdsFromStep(step, ctx);
    if (n > beatCount) beatCount = n;
    labels.push(step.label);
  }
  const needed =
    beatCount >= HERMES_BATCH_CONFIRM_BEAT_THRESHOLD && labels.length > 0;
  return { needed, beatCount, labels };
}

export function formatBatchConfirmPrompt(beatCount: number, labels: string[]): string {
  const steps = labels.map((l, i) => `${i + 1}. ${l}`).join("\n");
  return (
    `本次将批量处理约 **${beatCount}** 镜（含 API 调用）：\n${steps}\n\n` +
    `回复 **继续** 或 **确认** 开始执行；回复 **取消** 则不做。`
  );
}

export function isBatchConfirmReply(text: string): boolean {
  const t = text.trim();
  return /^(继续|确认|执行|开始|好的|好|可以|行|ok|yes|go)$/i.test(t);
}

export function isBatchCancelReply(text: string): boolean {
  const t = text.trim();
  return /^(取消|算了|不要|停止|不用|否|no)$/i.test(t);
}
