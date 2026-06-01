import { describe, expect, it } from "vitest";
import type { HermesJob } from "@/lib/hermes/agent/hermesJobStore";
import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";
import {
  buildJobCenterRows,
  listBackgroundHermesTasks,
  stepStatusGlyph,
  summarizeJobCenter,
} from "@/lib/hermes/agent/hermesJobCenterModel";

function sampleJob(
  id: string,
  status: HermesJob["status"],
  steps: HermesDirectorPlan["steps"],
): HermesJob {
  return {
    id,
    projectPath: "/proj",
    kind: "director_plan",
    status,
    title: `计划 ${id}`,
    createdAt: Date.now(),
    payload: {
      plan: {
        id: `plan-${id}`,
        title: `计划 ${id}`,
        sourceMessage: "测试",
        steps,
      },
    },
    stepStatuses:
      status === "running"
        ? { [steps[0]!.id]: "done", [steps[1]!.id]: "running" }
        : undefined,
    progress: status === "running" ? { done: 1, total: steps.length } : undefined,
  };
}

describe("hermesJobCenterModel", () => {
  it("sorts running before queued", () => {
    const steps = [
      { id: "s1", toolId: "canvas.summarize" as const, label: "步1" },
      { id: "s2", toolId: "canvas.summarize" as const, label: "步2" },
    ];
    const rows = buildJobCenterRows(
      [sampleJob("b", "queued", steps), sampleJob("a", "running", steps)],
      "/proj",
    );
    expect(rows[0]!.job.id).toBe("a");
    expect(rows[1]!.job.id).toBe("b");
  });

  it("builds step rows from job stepStatuses", () => {
    const steps = [
      { id: "s1", toolId: "canvas.summarize" as const, label: "分镜" },
      { id: "s2", toolId: "canvas.summarize" as const, label: "出图" },
    ];
    const rows = buildJobCenterRows([sampleJob("a", "running", steps)], "/proj");
    expect(rows[0]!.steps[0]!.status).toBe("done");
    expect(rows[0]!.steps[1]!.status).toBe("running");
    expect(stepStatusGlyph("done")).toBe("✓");
  });

  it("filters background tasks", () => {
    const bg = listBackgroundHermesTasks([
      {
        id: "planjob:j1",
        kind: "director",
        label: "计划",
        status: "running",
        updatedAt: Date.now(),
      },
      {
        id: "agent:n1",
        kind: "image",
        label: "镜 1·图",
        status: "running",
        updatedAt: Date.now(),
      },
    ]);
    expect(bg).toHaveLength(1);
    expect(bg[0]!.id).toBe("agent:n1");
  });

  it("summarizeJobCenter counts active jobs", () => {
    const steps = [
      { id: "s1", toolId: "canvas.summarize" as const, label: "步1" },
      { id: "s2", toolId: "canvas.summarize" as const, label: "步2" },
    ];
    const rows = buildJobCenterRows(
      [sampleJob("a", "running", steps), sampleJob("b", "queued", steps)],
      "/proj",
    );
    expect(summarizeJobCenter(rows, [])).toContain("进行中");
    expect(summarizeJobCenter(rows, [])).toContain("排队");
  });
});
