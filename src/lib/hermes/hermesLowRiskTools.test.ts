import { describe, expect, it } from "vitest";
import { isLowRiskPlanStep, splitPlanForAutoRun } from "@/lib/hermes/hermesLowRiskTools";
import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";

function plan(steps: HermesDirectorPlan["steps"]): HermesDirectorPlan {
  return {
    id: "p1",
    title: "test",
    sourceMessage: "x",
    steps,
    plannerSource: "rules",
  };
}

describe("hermesLowRiskTools", () => {
  it("treats patch without regen as low risk", () => {
    expect(
      isLowRiskPlanStep({
        id: "1",
        toolId: "storyboard.patch_shot",
        label: "改镜",
        args: { visualPrompt: "夜景" },
      }),
    ).toBe(true);
    expect(
      isLowRiskPlanStep({
        id: "2",
        toolId: "storyboard.patch_shot",
        label: "改镜出图",
        args: { regenerateImage: true },
      }),
    ).toBe(false);
  });

  it("splits leading low-risk prefix", () => {
    const p = plan([
      { id: "a", toolId: "canvas.focus", label: "定位" },
      { id: "b", toolId: "image.generate_for_beats", label: "出图" },
    ]);
    const split = splitPlanForAutoRun(p, true);
    expect(split.autoPrefix).toHaveLength(1);
    expect(split.remainder).toHaveLength(1);
    expect(split.remainder[0]?.toolId).toBe("image.generate_for_beats");
  });

  it("does not split when disabled", () => {
    const p = plan([{ id: "a", toolId: "canvas.focus", label: "定位" }]);
    const split = splitPlanForAutoRun(p, false);
    expect(split.autoPrefix).toHaveLength(0);
    expect(split.remainder).toHaveLength(1);
  });
});
