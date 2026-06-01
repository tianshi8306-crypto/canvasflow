import { describe, expect, it } from "vitest";
import type { HermesJob } from "@/lib/hermes/agent/hermesJobStore";
import {
  buildHermesJobAmbientSnapshot,
  formatHermesOrbJobTitle,
} from "@/lib/hermes/agent/hermesJobAmbient";

const plan = {
  sourceMessage: "出图",
  steps: [{ id: "s1", toolId: "x", label: "步骤 1" }],
};

function job(id: string, status: HermesJob["status"]): HermesJob {
  return {
    id,
    projectPath: "/proj",
    kind: "director_plan",
    status,
    title: "测试计划",
    createdAt: 1,
    payload: { plan: plan as HermesJob["payload"]["plan"] },
  };
}

describe("hermesJobAmbient", () => {
  it("returns invisible when no jobs", () => {
    expect(buildHermesJobAmbientSnapshot([], [], "/proj").visible).toBe(false);
  });

  it("summarizes active director jobs", () => {
    const snap = buildHermesJobAmbientSnapshot(
      [job("a", "running"), job("b", "queued")],
      [],
      "/proj",
    );
    expect(snap.visible).toBe(true);
    expect(snap.hasActive).toBe(true);
    expect(snap.running).toBe(1);
    expect(snap.queued).toBe(1);
    expect(snap.summary).toContain("进行中");
  });

  it("formatHermesOrbJobTitle for active snapshot", () => {
    const title = formatHermesOrbJobTitle(
      {
        visible: true,
        summary: "1 进行中",
        running: 1,
        queued: 0,
        failed: 0,
        hasActive: true,
      },
      "H",
    );
    expect(title).toContain("H");
    expect(title).toContain("进行中");
  });
});
