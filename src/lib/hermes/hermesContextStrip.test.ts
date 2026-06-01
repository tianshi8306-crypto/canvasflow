import { describe, expect, it } from "vitest";
import {
  formatHermesContextStripLine,
  resolveHermesContextStripTone,
  shouldShowHermesContextStrip,
} from "@/lib/hermes/hermesContextStrip";
import { buildHermesSituation } from "@/lib/hermes/hermesSituation";

describe("hermesContextStrip", () => {
  it("shouldShowHermesContextStrip 需工程路径", () => {
    expect(shouldShowHermesContextStrip(null)).toBe(false);
    expect(shouldShowHermesContextStrip("/proj")).toBe(true);
  });

  it("formatHermesContextStripLine 单行阶段 + headline", () => {
    const nodes = [
      {
        id: "s1",
        type: "scriptNode" as const,
        position: { x: 0, y: 0 },
        data: {
          scriptBeats: [{ id: "b1", shotNumber: "1", description: "开场" }],
          storyboardShots: [{ scriptBeatId: "b1", status: "ready", visualPrompt: "雨夜" }],
        },
      },
    ];
    const situation = buildHermesSituation(nodes as never, [], "/proj");
    const line = formatHermesContextStripLine(situation);
    expect(line).toContain("—");
    expect(line.length).toBeLessThanOrEqual(96);
  });

  it("resolveHermesContextStripTone 随 block/warn gap", () => {
    const empty = buildHermesSituation([], [], "/proj");
    expect(resolveHermesContextStripTone(empty)).toBe("neutral");

    const withWarn = {
      ...empty,
      gaps: [{ id: "video_failed", severity: "warn" as const, message: "2 镜视频失败" }],
    };
    expect(resolveHermesContextStripTone(withWarn)).toBe("warn");
  });
});
