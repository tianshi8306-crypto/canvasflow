import { describe, expect, it } from "vitest";
import { synthesizeStoryboardPromptFromBeat, patchBeatsWithSynthesizedPrompts } from "@/lib/scriptPromptSynthesis";
import type { ScriptBeat } from "@/lib/types";
import { normalizeScriptBeat } from "@/lib/scriptBeatHelpers";

function beat(partial: Partial<ScriptBeat>): ScriptBeat {
  return normalizeScriptBeat({
    id: "b1",
    shotNumber: "1-1",
    durationHint: "3s",
    description: "陈南与师父对峙",
    shotSize: "全景",
    cameraMove: "推",
    lightingMood: "冷色侧光",
    soundHint: "风声",
    dialogue: "对白",
    storyboardPrompt: "",
    ...partial,
  });
}

describe("scriptPromptSynthesis", () => {
  it("combines description and metadata", () => {
    const out = synthesizeStoryboardPromptFromBeat(beat({}));
    expect(out).toContain("陈南与师父对峙");
    expect(out).toContain("全景镜头");
    expect(out).toContain("冷色侧光");
    expect(out).not.toContain("BGM");
  });

  it("patches all beats when no filter", () => {
    const rows = [beat({ id: "a" }), beat({ id: "b", description: "第二镜" })];
    const next = patchBeatsWithSynthesizedPrompts(rows);
    expect(next[0].storyboardPrompt.length).toBeGreaterThan(10);
    expect(next[1].storyboardPrompt).toContain("第二镜");
  });
});
