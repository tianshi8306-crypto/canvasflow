import { describe, expect, it } from "vitest";
import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";
import {
  formatRecoverySuccessFact,
  isRecoveryOrientedPlan,
  recoveryMemoryKey,
} from "@/lib/hermes/hermesProactiveRecoveryMemory";
import {
  completedStepsFromState,
  executionStateFromStatuses,
} from "@/lib/hermes/agent/hermesJobReflection";

describe("hermesProactiveRecoveryMemory", () => {
  it("isRecoveryOrientedPlan 识别重试与灵体标记", () => {
    expect(
      isRecoveryOrientedPlan({
        id: "p",
        title: "t",
        sourceMessage: "x",
        steps: [{ id: "s", toolId: "video.retry_failed", label: "重试" }],
      }),
    ).toBe(true);
    expect(
      isRecoveryOrientedPlan({
        id: "p",
        title: "t",
        sourceMessage: "x",
        proactiveRecovery: true,
        steps: [{ id: "s", toolId: "canvas.summarize", label: "汇总" }],
      }),
    ).toBe(true);
  });

  it("formatRecoverySuccessFact 含 recover 标签", () => {
    const plan: HermesDirectorPlan = {
      id: "p1",
      title: "重试视频",
      sourceMessage: "帮我把失败镜头的视频重新生成",
      proactiveRecovery: true,
      orbSuggestionId: "video_failed",
      steps: [{ id: "s1", toolId: "video.retry_failed", label: "重试视频" }],
    };
    const fact = formatRecoverySuccessFact(
      plan,
      completedStepsFromState(
        plan,
        executionStateFromStatuses("p1", { s1: "done" }),
      ),
    );
    expect(fact).toContain("[recover:video_failed]");
    expect(fact).toContain("灵体主动恢复");
    expect(recoveryMemoryKey(plan)).toBe("video_failed");
  });
});
