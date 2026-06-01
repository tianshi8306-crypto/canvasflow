import { extractBiblePatchFromMessage } from "@/lib/hermes/hermesTools/bibleUpdateTool";
import type { HermesPlanStep } from "@/lib/hermes/hermesDirectorTypes";

const ASK_ONLY = /^(什么是|怎么|如何|为什么|介绍|解释)/;

/** 增量改梗概（非「帮我写一个故事」类全量创作） */
export function wantsNlBriefEdit(text: string): boolean {
  const t = text.trim();
  if (!t || ASK_ONLY.test(t)) return false;
  if (/镜头表|分镜|出图|出视频|全流程|一键|从头|镜头表/.test(t)) return false;
  if (/撰写|写一[个篇部]|帮我做|开始创作/.test(t)) return false;
  return (
    /(?:梗概|创意|故事简介|brief)(?:改成|改为|改|换|设|更新|写成)/i.test(t) ||
    /(?:改|换|设|更新)(?:一下)?(?:创意|梗概|故事)/i.test(t)
  );
}

export function extractNlBriefText(text: string): string | undefined {
  const patterns: RegExp[] = [
    /(?:梗概|创意|故事简介|brief)(?:改成|改为|改|换|设|更新|写成)[：: ]?[「"'『]?([^」"'，。；\n]{2,})/i,
    /(?:改|换|设|更新)(?:一下)?(?:创意|梗概|故事)(?:为|成|是)?[：: ]?[「"'『]?([^」"'，。；\n]{2,})/i,
    /把(?:创意|梗概)(?:改成|改为|改|换|设)成[：: ]?[「"'『]?([^」"'，。；\n]{2,})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    const chunk = m?.[1]?.trim();
    if (chunk && chunk.length >= 2) return chunk;
  }
  return undefined;
}

/** 改圣经字段（画风/梗概/禁忌/时长），不必说「项目圣经」 */
export function wantsNlBibleFieldEdit(text: string): boolean {
  const t = text.trim();
  if (!t || ASK_ONLY.test(t)) return false;
  if (/项目圣经|更新圣经|同步.*角色库/.test(t)) return false;
  const patch = extractBiblePatchFromMessage(t);
  if (Object.keys(patch).length === 0) return false;
  return /改|换|设|更新|写成|改为|改成|不要出现|避免/.test(t);
}

export function bibleUpdateArgsFromMessage(text: string): Record<string, unknown> {
  const patch = extractBiblePatchFromMessage(text);
  return {
    ...patch,
    ...( /同步.*角色|角色.*同步/.test(text) ? { syncCharacters: true } : {}),
  };
}

export function buildNlBriefEditLabel(briefText: string): string {
  const preview =
    briefText.length > 24 ? `${briefText.slice(0, 24)}…` : briefText;
  return `更新脚本梗概：${preview}`;
}

export function buildNlBibleEditLabel(args: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof args.logline === "string") parts.push("梗概");
  if (typeof args.visualStyle === "string") parts.push("画风");
  if (typeof args.taboos === "string") parts.push("禁忌");
  if (typeof args.targetDurationSec === "number") parts.push("时长");
  if (args.syncCharacters) parts.push("同步角色");
  return parts.length > 0 ? `更新项目圣经（${parts.join("、")}）` : "更新项目圣经";
}

export function enrichBriefStepFromMessage(
  step: HermesPlanStep,
  sourceMessage: string,
): HermesPlanStep {
  if (step.toolId !== "script.update_brief") return step;
  const fromNl = extractNlBriefText(sourceMessage);
  const cur = String(step.args?.briefText ?? "").trim();
  const briefText = cur || fromNl;
  if (!briefText) return step;
  return {
    ...step,
    label: step.label?.trim() ? step.label : buildNlBriefEditLabel(briefText),
    args: { ...step.args, briefText },
  };
}

export function enrichBibleStepFromMessage(
  step: HermesPlanStep,
  sourceMessage: string,
): HermesPlanStep {
  if (step.toolId !== "bible.update") return step;
  const fromNl = bibleUpdateArgsFromMessage(sourceMessage);
  const cur = (step.args ?? {}) as Record<string, unknown>;
  const merged = { ...fromNl, ...cur };
  if (Object.keys(merged).length === 0) return step;
  return {
    ...step,
    label: step.label?.trim() ? step.label : buildNlBibleEditLabel(merged),
    args: merged,
  };
}

export function enrichDirectorStepFromNlMessage(
  step: HermesPlanStep,
  sourceMessage: string,
): HermesPlanStep {
  if (step.toolId === "script.update_brief") {
    return enrichBriefStepFromMessage(step, sourceMessage);
  }
  if (step.toolId === "bible.update") {
    return enrichBibleStepFromMessage(step, sourceMessage);
  }
  return step;
}
