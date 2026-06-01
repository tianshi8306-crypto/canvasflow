import { describe, expect, it } from "vitest";
import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";
import {
  buildProcedureKey,
  completedStepsFromState,
  executionStateFromStatuses,
  formatExperienceFact,
  formatFailureFact,
  isSubstantiveProcedure,
  shouldWriteAutoSkill,
} from "@/lib/hermes/agent/hermesJobReflection";

function plan(steps: HermesDirectorPlan["steps"]): HermesDirectorPlan {
  return {
    id: "p1",
    title: "测试",
    steps,
    sourceMessage: "把 1-6 镜出图",
  };
}

describe("hermesJobReflection", () => {
  it("buildProcedureKey joins tool ids", () => {
    const steps = [
      { id: "s1", toolId: "script.generate_storyboard" as const, label: "分镜" },
      { id: "s2", toolId: "image.generate_for_beats" as const, label: "出图" },
    ];
    expect(buildProcedureKey(steps)).toBe(
      "script.generate_storyboard>image.generate_for_beats",
    );
  });

  it("shouldWriteAutoSkill when media + substantive", () => {
    const steps = [
      { id: "s1", toolId: "script.generate_storyboard" as const, label: "分镜" },
      { id: "s2", toolId: "image.generate_for_beats" as const, label: "出图" },
    ];
    expect(isSubstantiveProcedure(steps)).toBe(true);
    expect(shouldWriteAutoSkill(steps)).toBe(true);
  });

  it("formatExperienceFact includes proc tag", () => {
    const p = plan([
      { id: "s1", toolId: "script.generate_storyboard", label: "生成分镜" },
      { id: "s2", toolId: "image.generate_for_beats", label: "批量出图" },
    ]);
    const completed = completedStepsFromState(
      p,
      executionStateFromStatuses("p1", { s1: "done", s2: "done" }),
    );
    const fact = formatExperienceFact(p, completed);
    expect(fact).toContain("[proc:");
    expect(fact).toContain("1-6 镜出图");
  });

  it("formatFailureFact for failed step", () => {
    const p = plan([
      { id: "s1", toolId: "video.generate_for_beats", label: "出视频" },
    ]);
    const text = formatFailureFact(p.steps[0]!, "API 超时");
    expect(text).toContain("[fail:video.generate_for_beats]");
    expect(text).toContain("API 超时");
  });
});
