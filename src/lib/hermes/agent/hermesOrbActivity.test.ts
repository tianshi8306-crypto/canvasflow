import { describe, expect, it } from "vitest";
import type { HermesJob } from "@/lib/hermes/agent/hermesJobStore";
import {
  pickHermesOrbRecentTaskLines,
  resolveHermesOrbActivity,
} from "@/lib/hermes/agent/hermesOrbActivity";

const plan = {
  sourceMessage: "出图",
  steps: [{ id: "s1", toolId: "x", label: "步骤 1" }],
};

function job(id: string, status: HermesJob["status"], title: string): HermesJob {
  return {
    id,
    projectPath: "/proj",
    kind: "director_plan",
    status,
    title,
    createdAt: Number(id.replace(/\D/g, "")) || 1,
    payload: { plan: plan as HermesJob["payload"]["plan"] },
  };
}

describe("hermesOrbActivity", () => {
  it("failed beats planning and running", () => {
    expect(
      resolveHermesOrbActivity({
        planning: true,
        streaming: false,
        snapshot: {
          visible: true,
          summary: "1 失败",
          running: 1,
          queued: 0,
          failed: 1,
          hasActive: true,
        },
      }),
    ).toBe("failed");
  });

  it("planning when no jobs but planning flag", () => {
    expect(
      resolveHermesOrbActivity({
        planning: true,
        streaming: false,
        snapshot: {
          visible: false,
          summary: "",
          running: 0,
          queued: 0,
          failed: 0,
          hasActive: false,
        },
      }),
    ).toBe("planning");
  });

  it("running when jobs active", () => {
    expect(
      resolveHermesOrbActivity({
        planning: false,
        streaming: false,
        snapshot: {
          visible: true,
          summary: "1 进行中",
          running: 1,
          queued: 0,
          failed: 0,
          hasActive: true,
        },
      }),
    ).toBe("running");
  });

  it("pickHermesOrbRecentTaskLines returns at most two", () => {
    const lines = pickHermesOrbRecentTaskLines(
      [
        job("j1", "running", "计划 A"),
        job("j2", "queued", "计划 B"),
        job("j3", "queued", "计划 C"),
      ],
      [],
      "/proj",
      2,
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("计划 A");
  });
});
