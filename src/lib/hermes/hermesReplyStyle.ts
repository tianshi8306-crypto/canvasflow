import type { HermesMessageMode } from "@/lib/hermes/hermesMessageIntent";
import { hasHermesConsultIntent, resolveHermesMessageMode } from "@/lib/hermes/hermesMessageIntent";

/** Hermes 侧栏与纯聊天回复篇幅档位（由灵体推断，非用户手选） */
export type HermesReplyStyle = "concise" | "standard" | "detailed";

export type InferHermesReplyStyleInput = {
  userMessage: string;
  messageMode?: HermesMessageMode;
  advisorMode?: boolean;
  planStepCount?: number;
};

const BRIEF_ACK = /^(执行|开始|继续|确认|好的|好|ok|OK)$/i;
const DEEP_CONSULT =
  /为什么|如何|怎么理解|解释一下|详细说说|有什么区别|对比|分析|优缺点|原理|机制|科普|举例说明/;
const SHORT_EXECUTE_CMD = /^(分镜出图|出图|出视频|跑模板|建链|导出)$/i;

function needsDetailedReply(text: string): boolean {
  const t = text.trim();
  return (
    DEEP_CONSULT.test(t) ||
    (/[？?]/.test(t) && t.length > 48) ||
    (hasHermesConsultIntent(t) && t.length > 36)
  );
}

/**
 * 灵体按本轮意图自动选择回复篇幅：执行/改画布偏短，深度咨询可展开。
 */
export function inferHermesReplyStyle(input: InferHermesReplyStyleInput): HermesReplyStyle {
  const t = input.userMessage.trim();
  if (!t || BRIEF_ACK.test(t)) return "concise";

  const mode =
    input.messageMode ??
    (input.advisorMode ? "consult" : resolveHermesMessageMode(t));
  const steps = input.planStepCount ?? 0;

  if (mode === "execute") {
    if (SHORT_EXECUTE_CMD.test(t)) return "concise";
    if (steps <= 1 && t.length <= 56) return "concise";
    if (steps >= 4) return "standard";
    return "concise";
  }

  if (mode === "mixed") {
    return needsDetailedReply(t) ? "detailed" : "standard";
  }

  if (input.advisorMode) {
    if (needsDetailedReply(t) || t.length > 80) return "detailed";
    if (t.length <= 24) return "standard";
    return "standard";
  }

  if (needsDetailedReply(t)) return "detailed";
  if (t.length <= 28 && !/[？?]/.test(t)) return "concise";
  if (t.length <= 72) return "standard";
  return "detailed";
}

/** @deprecated 仅兼容旧存盘；新逻辑请用 inferHermesReplyStyle */
export function normalizeHermesReplyStyle(
  raw: string | undefined | null,
): HermesReplyStyle {
  if (raw === "standard" || raw === "detailed") return raw;
  return "concise";
}

export type HermesReplyLimits = {
  planReplyMax: number;
  chatSoftMaxHint: number;
  stripBoilerplate: boolean;
  knowledgeSnippetMax: number;
};

export function getHermesReplyLimits(style: HermesReplyStyle): HermesReplyLimits {
  switch (style) {
    case "detailed":
      return {
        planReplyMax: 240,
        chatSoftMaxHint: 400,
        stripBoilerplate: false,
        knowledgeSnippetMax: 800,
      };
    case "standard":
      return {
        planReplyMax: 120,
        chatSoftMaxHint: 200,
        stripBoilerplate: true,
        knowledgeSnippetMax: 500,
      };
    default:
      return {
        planReplyMax: 72,
        chatSoftMaxHint: 120,
        stripBoilerplate: true,
        knowledgeSnippetMax: 360,
      };
  }
}

export function shouldStripHermesBoilerplate(style: HermesReplyStyle): boolean {
  return getHermesReplyLimits(style).stripBoilerplate;
}
