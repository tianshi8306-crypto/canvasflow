import { describe, expect, it } from "vitest";
import type { HermesJob } from "@/lib/hermes/agent/hermesJobStore";
import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";
import {
  compareQueuedDirectorJobs,
  listQueuedDirectorJobs,
  pickNextQueuedDirectorJob,
  queuePriorityValue,
} from "@/lib/hermes/agent/hermesJobOrchestration";

function job(
  id: string,
  status: HermesJob["status"],
  priority: number,
  createdAt: number,
): HermesJob {
  const plan: HermesDirectorPlan = {
    id: "p",
    title: id,
    steps: [{ id: "s", toolId: "canvas.summarize", label: "x" }],
    sourceMessage: "",
  };
  return {
    id,
    projectPath: "/p",
    kind: "director_plan",
    status,
    title: id,
    createdAt,
    queuePriority: priority,
    payload: { plan },
  };
}

describe("hermesJobOrchestration", () => {
  it("picks higher priority first then fifo", () => {
    const jobs = [
      job("low", "queued", 0, 100),
      job("high", "queued", 10, 200),
      job("mid", "queued", 5, 50),
    ];
    expect(pickNextQueuedDirectorJob(jobs, "/p")?.id).toBe("high");
    expect(compareQueuedDirectorJobs(jobs[1]!, jobs[0]!)).toBeLessThan(0);
  });

  it("queuePriorityValue maps high to 10", () => {
    expect(queuePriorityValue("high")).toBe(10);
    expect(queuePriorityValue("normal")).toBe(0);
  });

  it("lists only queued director jobs for project", () => {
    const jobs = [
      job("a", "queued", 0, 1),
      job("b", "running", 0, 2),
      job("c", "queued", 0, 3),
    ];
    expect(listQueuedDirectorJobs(jobs, "/p").map((j) => j.id)).toEqual(["a", "c"]);
  });
});
