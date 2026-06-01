import { parseShotNumbersFromMessage } from "@/lib/hermes/hermesCanvasContext";
import {
  messageHasShotReferent,
  resolveHermesShotNumbers,
} from "@/lib/hermes/hermesReferentResolution";
import type { HermesPlanStep } from "@/lib/hermes/hermesDirectorTypes";
import type { PatchStoryboardShotArgs } from "@/lib/hermes/hermesTools/patchStoryboardShotTool";

export type HermesNlPatchIntent = {
  shotNumbers: number[];
  visualPrompt?: string;
  videoMotionPrompt?: string;
  compositionNote?: string;
  negativePrompt?: string;
  regenerateImage: boolean;
  regenerateVideo: boolean;
};

const PATCH_VERB =
  /改|换|调整|修改|更新|设为|变成|替换|重写|润色|优化.*(?:画面|描述|prompt|提示)/i;
const REGEN_ONLY = /重出|重新生成|再出|重新出/;

/** 是否像「改某一镜」而非纯批量出图/出视频 */
export function wantsNlPatchShot(text: string): boolean {
  const t = text.trim();
  if (/^(什么是|怎么|如何|为什么|介绍|解释)/.test(t)) return false;
  if (
    parseShotNumbersFromMessage(t).length === 0 &&
    !messageHasShotReferent(t)
  ) {
    return false;
  }
  if (REGEN_ONLY.test(t) && /图|视频/.test(t)) return true;
  if (PATCH_VERB.test(t)) return true;
  if (/画面(?:描述|文案)?[：:]\s*\S/.test(t)) return true;
  if (/第\s*\d+\s*镜\s*[:：]/.test(t)) return true;
  return false;
}

function stripPatchNoise(chunk: string): string {
  return chunk
    .replace(/^(?:画面|镜头|分镜)(?:描述|文案)?/i, "")
    .replace(/(?:再|并|然后)?\s*(?:出图|出视频|重新出图|重新出视频|重出图|重出视频).*$/i, "")
    .trim();
}

/** 从话术提取要写入 visualPrompt 的片段 */
export function extractNlVisualPrompt(text: string): string | undefined {
  const patterns: RegExp[] = [
    /(?:改成|改为|换成|修改为?|调整为?|设为|变成|替换为?)\s*[「"'『【]?([^「」"'，。；\n]+?)[」"'』】]?(?:\s*再|\s*并|并|然后|$|[，。；])/,
    /画面(?:描述|文案)?(?:改成|改为|换成|为|是|：|:)\s*([^，。；\n]+)/,
    /第\s*\d+\s*镜\s*[：:]\s*([^，。；\n]+)/,
    /(?:视觉|画面)\s*[：:]\s*([^，。；\n]+)/,
    /(?:镜头|分镜)\s*(?:改成|改为|换成)\s*([^，。；\n]+)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    const raw = m?.[1]?.trim();
    if (!raw) continue;
    const chunk = stripPatchNoise(raw);
    if (chunk.length >= 2 && !/^出(图|视频)/.test(chunk) && !/^重新/.test(chunk)) {
      return chunk;
    }
  }
  return undefined;
}

export function extractNlVideoMotionPrompt(text: string): string | undefined {
  const patterns = [
    /(?:运镜|动作|视频动作|人物动作)(?:提示词)?(?:改成|改为|换成|为|是|：|:)\s*([^，。；\n]+)/,
    /(?:motion|动作)\s*[：:]\s*([^，。；\n]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    const chunk = m?.[1]?.trim();
    if (chunk && chunk.length >= 2) return chunk;
  }
  return undefined;
}

export function extractNlCompositionNote(text: string): string | undefined {
  const m = text.match(
    /(?:构图|景别|镜头类型)(?:改成|改为|换成|为|是|：|:)\s*([^，。；\n]+)/,
  );
  const chunk = m?.[1]?.trim();
  return chunk && chunk.length >= 2 ? chunk : undefined;
}

export function extractNlNegativePrompt(text: string): string | undefined {
  const m = text.match(
    /(?:不要|避免|排除|负向|negative)(?:出现|有|包含)?[：: ]?\s*([^，。；\n]+)/i,
  );
  const chunk = m?.[1]?.trim();
  return chunk && chunk.length >= 2 ? chunk : undefined;
}

function wantsRegenImageInPatch(text: string): boolean {
  if (/出视频|生成视频|图生视频|批量视频/.test(text) && !/出图|关键帧|生图/.test(text)) {
    return false;
  }
  return (
    /重出图|再出图|重新出图|出.*图|关键帧|生图|渲染图/.test(text) ||
    (/改|换|调整/.test(text) && /出图/.test(text))
  );
}

function wantsRegenVideoInPatch(text: string): boolean {
  return /重出视频|再出视频|重新出视频|出.*视频|生成视频/.test(text);
}

/** 规则解析 NL → patch_shot 入参 */
export function parseHermesNlPatchIntent(text: string): HermesNlPatchIntent | null {
  const shotNumbers = resolveHermesShotNumbers(text);
  if (shotNumbers.length === 0) return null;

  return {
    shotNumbers,
    visualPrompt: extractNlVisualPrompt(text),
    videoMotionPrompt: extractNlVideoMotionPrompt(text),
    compositionNote: extractNlCompositionNote(text),
    negativePrompt: extractNlNegativePrompt(text),
    regenerateImage: wantsRegenImageInPatch(text),
    regenerateVideo: wantsRegenVideoInPatch(text),
  };
}

export function patchArgsFromNlIntent(
  intent: HermesNlPatchIntent,
): PatchStoryboardShotArgs {
  return {
    beatIds: intent.shotNumbers,
    ...(intent.visualPrompt ? { visualPrompt: intent.visualPrompt } : {}),
    ...(intent.videoMotionPrompt ? { videoMotionPrompt: intent.videoMotionPrompt } : {}),
    ...(intent.compositionNote ? { compositionNote: intent.compositionNote } : {}),
    ...(intent.negativePrompt ? { negativePrompt: intent.negativePrompt } : {}),
    regenerateImage: intent.regenerateImage,
    regenerateVideo: intent.regenerateVideo,
  };
}

export function buildPatchShotLabel(intent: HermesNlPatchIntent): string {
  const nums = intent.shotNumbers.join("、");
  const parts: string[] = [];
  if (intent.visualPrompt) parts.push(`更新第 ${nums} 镜画面`);
  else if (intent.videoMotionPrompt || /运镜|运动/.test(intent.videoMotionPrompt ?? "")) {
    parts.push(`更新第 ${nums} 镜运镜`);
  } else parts.push(`调整第 ${nums} 镜`);
  if (intent.regenerateImage) parts.push("重新出图");
  if (intent.regenerateVideo) parts.push("重新出视频");
  return parts.join("并");
}

/** LLM 步骤缺字段时，用用户原文补全 patch_shot args */
export function enrichPatchStepFromMessage(
  step: HermesPlanStep,
  sourceMessage: string,
): HermesPlanStep {
  if (step.toolId !== "storyboard.patch_shot") return step;
  const intent = parseHermesNlPatchIntent(sourceMessage);
  if (!intent) return step;

  const fromNl = patchArgsFromNlIntent(intent);
  const cur = (step.args ?? {}) as PatchStoryboardShotArgs;
  const beatIds =
    Array.isArray(cur.beatIds) && cur.beatIds.length > 0
      ? cur.beatIds
      : fromNl.beatIds;

  return {
    ...step,
    label: step.label?.trim() ? step.label : buildPatchShotLabel(intent),
    args: {
      ...fromNl,
      ...cur,
      beatIds,
      visualPrompt: cur.visualPrompt?.trim() || fromNl.visualPrompt,
      videoMotionPrompt: cur.videoMotionPrompt?.trim() || fromNl.videoMotionPrompt,
      compositionNote: cur.compositionNote?.trim() || fromNl.compositionNote,
      negativePrompt: cur.negativePrompt?.trim() || fromNl.negativePrompt,
      regenerateImage: cur.regenerateImage ?? fromNl.regenerateImage,
      regenerateVideo: cur.regenerateVideo ?? fromNl.regenerateVideo,
    },
  };
}
