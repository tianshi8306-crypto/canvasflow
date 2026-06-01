import { beforeEach, describe, expect, it } from "vitest";
import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";
import {
  loadHermesJobsFromSession,
  saveHermesJobsToSession,
} from "@/lib/hermes/agent/hermesJobPersistence";
import type { HermesJob } from "@/lib/hermes/agent/hermesJobStore";

function sampleJob(id: string, status: HermesJob["status"]): HermesJob {
  const plan: HermesDirectorPlan = {
    id: `plan-${id}`,
    title: "测试",
    steps: [{ id: "s1", toolId: "canvas.summarize", label: "汇总" }],
    sourceMessage: "测试",
  };
  return {
    id,
    projectPath: "/proj",
    kind: "director_plan",
    status,
    title: "测试任务",
    createdAt: Date.now(),
    finishedAt: status === "done" ? Date.now() : undefined,
    payload: { plan },
  };
}

describe("hermesJobPersistence", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("round-trips finished jobs via sessionStorage", () => {
    saveHermesJobsToSession("/proj", [sampleJob("j1", "done")]);
    const loaded = loadHermesJobsFromSession("/proj");
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.status).toBe("done");
    expect(loaded[0]?.payload.plan.steps[0]?.label).toBe("汇总");
  });

  it("does not persist running jobs in history slice", () => {
    saveHermesJobsToSession("/proj", [
      sampleJob("run", "running"),
      sampleJob("done", "done"),
    ]);
    const loaded = loadHermesJobsFromSession("/proj");
    expect(loaded.some((j) => j.id === "run")).toBe(false);
    expect(loaded.some((j) => j.id === "done")).toBe(true);
  });
});
