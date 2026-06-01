import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";
import type { HermesMessageMode } from "@/lib/hermes/hermesMessageIntent";
import {
  getHermesReplyLimits,
  inferHermesReplyStyle,
  shouldStripHermesBoilerplate,
  type HermesReplyStyle,
} from "@/lib/hermes/hermesReplyStyle";

/** 侧栏计划展示：plannerReply 上限（简洁档默认） */
export const HERMES_PLAN_REPLY_MAX = 72;

/** 顾问聊天软上限（简洁档默认） */
export const HERMES_CHAT_SOFT_MAX_HINT = 120;

export function clampHermesChatText(
  text: string | undefined,
  max = HERMES_PLAN_REPLY_MAX,
): string {
  const t = text?.trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** 去掉模型常见的客套收尾 */
export function stripHermesChatBoilerplate(text: string): string {
  return text
    .replace(/\n*如果还需要[^。\n]*[。\n]?/g, "")
    .replace(/\n*随时告诉我[^。\n]*[。\n]?/g, "")
    .replace(/\n*有需要[^。\n]*随时[^。\n]*[。\n]?/g, "")
    .replace(/\*\*操作结果[：:]\*\*[\s\S]*$/i, "")
    .replace(/已确认你的指令[。.]?/gi, "")
    .trim();
}

function resolvePlanLimits(
  plan: HermesDirectorPlan,
  style?: HermesReplyStyle,
  messageMode?: HermesMessageMode,
) {
  const resolved =
    style ??
    inferHermesReplyStyle({
      userMessage: plan.sourceMessage,
      messageMode,
      planStepCount: plan.steps.length,
    });
  return getHermesReplyLimits(resolved);
}

/**
 * 侧栏展示用：短步骤列表，默认不展开 assumptions/risks/脚注。
 */
export function formatPlanStepsForChat(
  plan: HermesDirectorPlan,
  opts?: { style?: HermesReplyStyle; messageMode?: HermesMessageMode },
): string {
  const limits = resolvePlanLimits(plan, opts?.style, opts?.messageMode);
  const style =
    opts?.style ??
    inferHermesReplyStyle({
      userMessage: plan.sourceMessage,
      messageMode: opts?.messageMode,
      planStepCount: plan.steps.length,
    });
  const lines = plan.steps.map((s, i) => `${i + 1}. ${s.label}`);
  if (plan.steps.length === 0) {
    return (
      clampHermesChatText(plan.plannerReply, limits.planReplyMax) || "（无执行步骤）"
    );
  }

  if (plan.steps.length === 1 && plan.plannerSource === "rules") {
    return lines[0]!;
  }

  let replyRaw = plan.plannerReply ?? "";
  if (shouldStripHermesBoilerplate(style)) {
    replyRaw = stripHermesChatBoilerplate(replyRaw);
  }
  const reply = clampHermesChatText(replyRaw, limits.planReplyMax);
  if (reply) {
    return `${reply}\n${lines.join("\n")}`;
  }
  return lines.join("\n");
}

/** 混合模式（咨询+执行）侧栏 plannerReply 前缀 */
export function formatPlannerNoteForMixed(
  reply: string | undefined,
  ctx: { userMessage: string; messageMode?: HermesMessageMode; planStepCount?: number },
): string {
  const t = reply?.trim();
  if (!t) return "";
  const style = inferHermesReplyStyle({
    userMessage: ctx.userMessage,
    messageMode: ctx.messageMode,
    planStepCount: ctx.planStepCount,
  });
  const limits = getHermesReplyLimits(style);
  let text = t;
  if (shouldStripHermesBoilerplate(style)) {
    text = stripHermesChatBoilerplate(text);
  }
  const clipped = clampHermesChatText(text, limits.planReplyMax);
  return clipped ? `${clipped}\n\n` : "";
}
