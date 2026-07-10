import { describe, expect, it, vi, beforeEach } from "vitest";
import { normalizeScriptBeat } from "@/lib/scriptBeatHelpers";
import { polishStoryboardPromptsWithLlm } from "@/lib/scriptPromptPolish";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(() => false),
  invoke: vi.fn(),
}));

describe("scriptPromptPolish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to rule synthesis when not in Tauri", async () => {
    const beat = normalizeScriptBeat({
      id: "b1",
      shotNumber: "1",
      description: "崖边对峙",
      shotSize: "全景",
      lightingMood: "冷色侧光",
      storyboardPrompt: "",
    });
    const r = await polishStoryboardPromptsWithLlm([beat], {});
    expect(r.usedLlm).toBe(false);
    expect(r.beats[0]?.storyboardPrompt).toContain("崖边对峙");
    expect(r.beats[0]?.storyboardPrompt).toContain("冷色侧光");
  });
});
