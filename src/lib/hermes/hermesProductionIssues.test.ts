import { describe, expect, it } from "vitest";
import type { HermesCanvasContext } from "@/lib/hermes/hermesCanvasContext";
import {
  detectProductionIssues,
  repairStepsFromProductionIssues,
} from "@/lib/hermes/hermesProductionIssues";
import type { HermesProductionSnapshot } from "@/lib/hermes/hermesSituation";

const canvas: HermesCanvasContext = {
  projectPath: "/p",
  scriptNodeId: "s1",
  beatCount: 4,
  storyboardReadyCount: 2,
  hasBrief: true,
  beatIds: ["b1", "b2", "b3", "b4"],
};

const production: HermesProductionSnapshot = {
  beatCount: 4,
  storyboardReady: 2,
  storyboardMissing: 2,
  storyboardFailed: 1,
  imageReady: 1,
  imageMissing: 1,
  videoGenerated: 1,
  videoFailed: 1,
  videoEligible: 0,
  videoMissing: 0,
  exportReady: 0,
  exportTotal: 2,
};

describe("hermesProductionIssues", () => {
  it("无脚本节点时不报制片断链", () => {
    const issues = detectProductionIssues(
      {
        beatCount: 0,
        storyboardReady: 0,
        storyboardMissing: 0,
        storyboardFailed: 0,
        imageReady: 0,
        imageMissing: 0,
        videoGenerated: 0,
        videoFailed: 0,
        videoEligible: 0,
        videoMissing: 0,
        exportReady: 0,
        exportTotal: 0,
      },
      {
        projectPath: "/p",
        scriptNodeId: null,
        beatCount: 0,
        storyboardReadyCount: 0,
        hasBrief: false,
        beatIds: [],
      },
    );
    expect(issues).toHaveLength(0);
  });

  it("无梗概时不报镜头表为空", () => {
    const issues = detectProductionIssues(
      {
        beatCount: 0,
        storyboardReady: 0,
        storyboardMissing: 0,
        storyboardFailed: 0,
        imageReady: 0,
        imageMissing: 0,
        videoGenerated: 0,
        videoFailed: 0,
        videoEligible: 0,
        videoMissing: 0,
        exportReady: 0,
        exportTotal: 0,
      },
      {
        projectPath: "/p",
        scriptNodeId: "s1",
        beatCount: 0,
        storyboardReadyCount: 0,
        hasBrief: false,
        beatIds: [],
      },
    );
    expect(issues.some((i) => i.id === "empty_beats")).toBe(false);
  });

  it("detects storyboard gap and video failures", () => {
    const issues = detectProductionIssues(production, canvas);
    expect(issues.some((i) => i.id === "keyframe_failed_batch")).toBe(true);
    expect(issues.some((i) => i.id === "video_failed_batch")).toBe(true);
  });

  it("repairStepsFromProductionIssues dedupes tools", () => {
    const issues = detectProductionIssues(production, canvas);
    const steps = repairStepsFromProductionIssues(issues, 3);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.length).toBeLessThanOrEqual(3);
  });
});
