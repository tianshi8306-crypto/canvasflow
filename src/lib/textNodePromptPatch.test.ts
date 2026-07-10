import { describe, expect, it } from "vitest";
import { normalizeScriptBeat } from "@/lib/scriptBeatHelpers";
import { mergeTextNodeDataPatch } from "@/lib/textNodePromptPatch";

describe("mergeTextNodeDataPatch scriptNode", () => {
  it("reconciles scriptBeats on scriptNode patch", () => {
    const english = "cinematic wide shot, moody blue light";
    const beats = [
      normalizeScriptBeat({
        id: "b1",
        shotNumber: "1",
        description: "崖边对峙",
        shotSize: "全景",
        storyboardPrompt: english,
      }),
    ];
    const merged = mergeTextNodeDataPatch("scriptNode", { scriptBeats: beats });
    const out = merged.scriptBeats?.[0];
    expect(out?.seedancePositive).toBe(english);
    expect(out?.storyboardPrompt).toContain("崖边对峙");
    expect(out?.storyboardPrompt).not.toContain("cinematic");
  });

  it("leaves non-script nodes unchanged", () => {
    const merged = mergeTextNodeDataPatch("textNode", { prompt: "  hello  " });
    expect(merged.prompt).toBeDefined();
    expect(merged.scriptBeats).toBeUndefined();
  });
});
