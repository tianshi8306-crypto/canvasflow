import { describe, expect, it } from "vitest";
import {
  compactVideoPromptPillLabel,
  pickVideoPromptPillDensity,
  resolveVideoPromptPillLayout,
} from "@/lib/videoPromptPillLayout";

const FONT = "400 13px Arial";

describe("compactVideoPromptPillLabel", () => {
  it("shortens slot labels", () => {
    expect(compactVideoPromptPillLabel("图片4")).toBe("图4");
    expect(compactVideoPromptPillLabel("视频2")).toBe("视2");
  });
});

describe("pickVideoPromptPillDensity", () => {
  it("uses full density for long brace tokens", () => {
    expect(pickVideoPromptPillDensity("{{Portrait 4}}", "图片4", FONT)).toBe("full");
  });

  it("downgrades for short @图片N tokens", () => {
    const layout = resolveVideoPromptPillLayout("@图片1", "图片1", FONT);
    expect(["medium", "compact", "icon"]).toContain(layout.density);
    expect(layout.density).not.toBe("full");
  });

  it("uses icon density for very short named tokens", () => {
    expect(pickVideoPromptPillDensity("@陈", "陈南", FONT)).toBe("icon");
  });
});
