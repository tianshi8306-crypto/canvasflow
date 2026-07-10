import { describe, expect, it } from "vitest";
import {
  getScriptGenerationDisplayLabel,
  getScriptGenerationProgressPercent,
} from "./scriptGenerationProgressDisplay";

describe("getScriptGenerationProgressPercent", () => {
  it("hides fake 50% while graph is running", () => {
    expect(getScriptGenerationProgressPercent({ progress: 50, isGraphRunning: true })).toBeUndefined();
  });

  it("shows real shot progress above 50", () => {
    expect(getScriptGenerationProgressPercent({ progress: 72, isGraphRunning: true })).toBe(72);
  });
});

describe("getScriptGenerationDisplayLabel", () => {
  it("uses storyboard copy when storyboard busy", () => {
    expect(getScriptGenerationDisplayLabel({ isStoryboardBusy: true, progress: 60 })).toBe(
      "正在生成分镜 60%…",
    );
  });

  it("omits percent during DAG without shot progress", () => {
    expect(
      getScriptGenerationDisplayLabel({ isGraphRunning: true, progress: 50 }),
    ).toBe("正在逐镜解析剧本…");
  });

  it("shows shot progress when available", () => {
    expect(
      getScriptGenerationDisplayLabel({ isGraphRunning: true, progress: 65 }),
    ).toBe("正在逐镜解析 65%…");
  });
});
