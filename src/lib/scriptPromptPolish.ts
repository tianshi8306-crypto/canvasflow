import { invoke, isTauri } from "@tauri-apps/api/core";
import { extractJsonArray } from "@/lib/storyboardParse";
import type { ScriptBeat } from "@/lib/types";
import {
  patchBeatsWithSynthesizedPrompts,
  synthesizeStoryboardPromptFromBeat,
} from "@/lib/scriptPromptSynthesis";

const POLISH_SYSTEM = `你是影视分镜文案编辑。用户给出多条镜头的中文字段与规则草稿，请润色为流畅的中文分镜提示词（每条 1–2 句，供导演/摄影师确认，不要用英文 Seedance 关键词）。

务必只输出 JSON 数组，不要用 markdown 代码块。数组元素格式：
{"beatId":"与输入一致","storyboardPrompt":"润色后的中文分镜提示词"}`;

type PolishRow = { beatId?: string; storyboardPrompt?: string };

function buildPolishPayload(beats: ScriptBeat[]) {
  return beats.map((b) => ({
    beatId: b.id,
    description: (b.description ?? "").trim(),
    shotSize: (b.shotSize ?? "").trim(),
    lightingMood: (b.lightingMood ?? "").trim(),
    cameraMove: (b.cameraMove ?? "").trim(),
    dialogue: (b.dialogue ?? "").replace(/\*\*/g, "").trim(),
    soundHint: (b.soundHint ?? "").trim(),
    draftPrompt: synthesizeStoryboardPromptFromBeat(b),
  }));
}

export type PolishStoryboardPromptsResult = {
  beats: ScriptBeat[];
  polishedCount: number;
  usedLlm: boolean;
};

/** 先规则合成，再可选 LLM 润色 storyboardPrompt（保留 seedancePositive） */
export async function polishStoryboardPromptsWithLlm(
  beats: ScriptBeat[],
  llmParams: { providerId?: string; model?: string },
): Promise<PolishStoryboardPromptsResult> {
  const baselined = patchBeatsWithSynthesizedPrompts(beats);
  if (!isTauri() || baselined.length === 0) {
    return { beats: baselined, polishedCount: baselined.length, usedLlm: false };
  }

  const raw = await invoke<string>("llm_complete_text", {
    systemPrompt: POLISH_SYSTEM,
    userPrompt: `请润色以下镜头的分镜提示词：\n${JSON.stringify(buildPolishPayload(baselined), null, 2)}`,
    ...llmParams,
  });

  const parsed = extractJsonArray<PolishRow>(raw) ?? [];
  if (parsed.length === 0) {
    return { beats: baselined, polishedCount: 0, usedLlm: true };
  }

  const byId = new Map(
    parsed
      .map((row) => {
        const id = (row.beatId ?? "").trim();
        const prompt = (row.storyboardPrompt ?? "").trim();
        return id && prompt ? ([id, prompt] as const) : null;
      })
      .filter((x): x is readonly [string, string] => x != null),
  );

  let polishedCount = 0;
  const next = baselined.map((b) => {
    const polished = byId.get(b.id);
    if (!polished) return b;
    polishedCount += 1;
    return { ...b, storyboardPrompt: polished };
  });

  return { beats: next, polishedCount, usedLlm: true };
}
