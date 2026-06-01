import { describe, expect, it } from "vitest";
import {
  proposeFailureRecoveryPlan,
  type HermesFailureContext,
} from "@/lib/hermes/hermesFailureRecovery";
import type { HermesDirectorPlan, HermesPlanStep } from "@/lib/hermes/hermesDirectorTypes";

const canvas = {
  projectPath: "/p",
  scriptNodeId: "s1",
  beatCount: 5,
  storyboardReadyCount: 5,
  hasBrief: true,
  beatIds: ["b1"],
};

function parentPlan(): HermesDirectorPlan {
  return {
    id: "parent",
    title: "t",
    sourceMessage: "出视频",
    steps: [],
  };
}

function fail(toolId: HermesPlanStep["toolId"], label: string): HermesFailureContext {
  return {
    failedStep: { id: "f1", toolId, label },
    errorMessage: "3 failed",
    parentPlan: parentPlan(),
  };
}

describe("proposeFailureRecoveryPlan", () => {
  it("video batch failure suggests retry_failed", () => {
    const plan = proposeFailureRecoveryPlan(
      fail("video.generate_for_beats", "批量视频"),
      canvas,
    );
    expect(plan?.isRecovery).toBe(true);
    expect(plan?.steps[0]?.toolId).toBe("video.retry_failed");
  });

  it("image batch failure suggests retry_failed", () => {
    const plan = proposeFailureRecoveryPlan(
      fail("image.generate_for_beats", "批量出图失败"),
      canvas,
    );
    expect(plan?.steps[0]?.toolId).toBe("image.retry_failed");
  });

  it("image failure without failure hint retries generate", () => {
    const plan = proposeFailureRecoveryPlan(
      {
        failedStep: { id: "f1", toolId: "image.generate_for_beats", label: "批量出图" },
        errorMessage: "network timeout",
        parentPlan: parentPlan(),
      },
      canvas,
    );
    expect(plan?.steps[0]?.toolId).toBe("image.generate_for_beats");
  });

  it("chain failure respawns chain", () => {
    const plan = proposeFailureRecoveryPlan(
      fail("chain.spawn_media_nodes", "建链"),
      canvas,
    );
    expect(plan?.steps[0]?.toolId).toBe("chain.spawn_media_nodes");
  });
});
