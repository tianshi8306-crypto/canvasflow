import type { ScriptBeat } from "@/lib/types";
import { normalizeScriptBeat } from "@/lib/scriptBeatHelpers";
import { normalizeCameraMove, normalizeShotSize } from "@/lib/scriptBeatFieldNormalize";

/** 文本是否以拉丁字母为主（多为 Seedance 英文提示词） */
export function isLikelyEnglishSeedancePrompt(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/[\u4e00-\u9fff]/.test(t) && /\[画面构图：|主体内容：|第二幕：\[/.test(t)) {
    return false;
  }
  const latin = (t.match(/[A-Za-z]/g) ?? []).length;
  const cjk = (t.match(/[\u4e00-\u9fff]/g) ?? []).length;
  if (cjk > 0 && latin === 0) return false;
  return latin > cjk;
}

/** 专业视图 / 出片用的 Seedance 正向（英文） */
export function getSeedancePositivePrompt(beat: ScriptBeat): string {
  const seedance = (beat.seedancePositive ?? "").trim();
  if (seedance) return seedance;
  const legacy = (beat.storyboardPrompt ?? "").trim();
  return isLikelyEnglishSeedancePrompt(legacy) ? legacy : "";
}

/** 基本表「分镜提示词」：由中文字段实时合成，不展示英文 Seedance */
export function getBasicViewStoryboardPrompt(beat: ScriptBeat): string {
  return synthesizeStoryboardPromptFromBeat(beat);
}

/** 由基本镜头字段合成分镜正向提示词（本地规则，可后续换 LLM） */
export function synthesizeStoryboardPromptFromBeat(beat: ScriptBeat): string {
  const parts: string[] = [];
  const desc = (beat.description ?? "").trim();
  if (desc) parts.push(desc);

  const meta: string[] = [];
  const shotSize = normalizeShotSize((beat.shotSize ?? "").trim());
  const cameraMove = normalizeCameraMove((beat.cameraMove ?? "").trim());
  const lighting = (beat.lightingMood ?? "").trim();
  const sound = (beat.soundHint ?? "").trim();
  const emotion = (beat.emotion ?? "").trim();
  const bgm = (beat.bgmHint ?? "").trim();

  if (shotSize) meta.push(`${shotSize}镜头`);
  if (cameraMove && cameraMove !== "固定") meta.push(`${cameraMove}运镜`);
  if (lighting) meta.push(lighting);
  if (emotion) meta.push(`情绪：${emotion}`);
  if (sound) meta.push(`音效：${sound}`);
  if (bgm) meta.push(`配乐：${bgm}`);

  const dialogue = (beat.dialogue ?? "").replace(/\*\*/g, "").trim();
  if (dialogue) meta.push(`对白：${dialogue}`);

  if (meta.length > 0) {
    parts.push(meta.join("，"));
  }

  return parts.join("；");
}

/**
 * 解析回写 / 持久化：英文 Seedance 保留在 seedancePositive，storyboardPrompt 改为中文合成。
 */
export function reconcileBeatPromptFields(beat: ScriptBeat): ScriptBeat {
  const normalized = normalizeScriptBeat(beat);
  let seedancePositive = (normalized.seedancePositive ?? "").trim();
  const storyboardRaw = normalized.storyboardPrompt.trim();

  if (!seedancePositive && isLikelyEnglishSeedancePrompt(storyboardRaw)) {
    seedancePositive = storyboardRaw;
  }

  const chinesePrompt = synthesizeStoryboardPromptFromBeat(normalized);
  return {
    ...normalized,
    seedancePositive: seedancePositive || undefined,
    storyboardPrompt:
      chinesePrompt ||
      (isLikelyEnglishSeedancePrompt(storyboardRaw) ? "" : storyboardRaw),
  };
}

export function reconcileBeatsPromptFields(beats: ScriptBeat[]): ScriptBeat[] {
  return beats.map(reconcileBeatPromptFields);
}

export function patchBeatsWithSynthesizedPrompts(
  beats: ScriptBeat[],
  beatIds?: string[],
): ScriptBeat[] {
  const filter = beatIds && beatIds.length > 0 ? new Set(beatIds) : null;
  return beats.map((b) => {
    if (filter && !filter.has(b.id)) return b;
    return reconcileBeatPromptFields({
      ...b,
      storyboardPrompt: synthesizeStoryboardPromptFromBeat(b),
    });
  });
}