import { describe, expect, it } from "vitest";
import { buildSeedanceVideoPromptFromVisual } from "@/lib/hermes/film/filmShotToVideoPrompt";

describe("buildSeedanceVideoPromptFromVisual", () => {
  it("appends motion and style for 写实", () => {
    const p = buildSeedanceVideoPromptFromVisual("女孩站在雨中的街道", {
      style: "写实",
    });
    expect(p).toContain("女孩站在雨中的街道");
    expect(p).toContain("电影级写实");
    expect(p).toContain("镜头运动平稳");
  });

  it("uses 古风 suffix when requested", () => {
    const p = buildSeedanceVideoPromptFromVisual("宫殿长廊", { style: "古风" });
    expect(p).toContain("中国古风");
  });

  it("returns empty for blank visual", () => {
    expect(buildSeedanceVideoPromptFromVisual("  ")).toBe("");
  });
});
