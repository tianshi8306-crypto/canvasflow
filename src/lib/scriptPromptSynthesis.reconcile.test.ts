import { describe, expect, it } from "vitest";
import type { ScriptBeat } from "@/lib/types";
import { normalizeScriptBeat } from "@/lib/scriptBeatHelpers";
import {
  getBasicViewStoryboardPrompt,
  getSeedancePositivePrompt,
  isLikelyEnglishSeedancePrompt,
  reconcileBeatPromptFields,
} from "@/lib/scriptPromptSynthesis";

function beat(partial: Partial<ScriptBeat>): ScriptBeat {
  return normalizeScriptBeat({
    id: "b1",
    shotNumber: "1",
    durationHint: "3s",
    description: "陈南站在崖边回望",
    shotSize: "全景",
    cameraMove: "推",
    lightingMood: "冷色侧光",
    dialogue: "无",
    storyboardPrompt: "",
    ...partial,
  });
}

describe("scriptPromptSynthesis reconcile", () => {
  it("detects english seedance prompt", () => {
    expect(isLikelyEnglishSeedancePrompt("cinematic wide shot, moody lighting")).toBe(true);
    expect(isLikelyEnglishSeedancePrompt("全景镜头，冷色侧光")).toBe(false);
  });

  it("treats chinese structured seedance template as non-english", () => {
    const cn =
      "第二幕：[画面构图：x]+[主体内容：x]+[人物空间与互动关系：x]+[微表情：x]+[场景环境：x]+[光影：x]+[风格：x]+[技术：x]";
    expect(isLikelyEnglishSeedancePrompt(cn)).toBe(false);
  });

  it("moves english parse output to seedancePositive and shows chinese in basic view", () => {
    const english =
      "cinematic wide shot, young man on cliff, moody blue light, 8k, film grain";
    const reconciled = reconcileBeatPromptFields(
      beat({ storyboardPrompt: english, seedancePositive: undefined }),
    );
    expect(reconciled.seedancePositive).toBe(english);
    expect(reconciled.storyboardPrompt).toContain("陈南站在崖边回望");
    expect(reconciled.storyboardPrompt).not.toContain("cinematic");
    expect(getBasicViewStoryboardPrompt(reconciled)).toBe(reconciled.storyboardPrompt);
    expect(getSeedancePositivePrompt(reconciled)).toBe(english);
  });
});
