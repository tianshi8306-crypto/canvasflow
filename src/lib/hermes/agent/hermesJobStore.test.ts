import { beforeEach, describe, expect, it } from "vitest";
import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";
import {
  countQueuedDirectorJobs,
  countRunningDirectorJobs,
  HERMES_JOB_CANCELLED_ERROR,
  hasActiveDirectorJobs,
  isDirectorJobCancelRequested,
  registerDirectorPlanJobExecutor,
  resetHermesJobStoreForTest,
  titleForDirectorPlan,
  useHermesJobStore,
} from "@/lib/hermes/agent/hermesJobStore";

function samplePlan(id: string): HermesDirectorPlan {
  return {
    id,
    title: "测试计划",
    steps: [
      { id: "s1", toolId: "canvas.summarize", label: "汇总画布" },
      { id: "s2", toolId: "canvas.summarize", label: "第二步" },
    ],
    sourceMessage: "帮我汇总",
  };
}

describe("hermesJobStore", () => {
  beforeEach(() => {
    resetHermesJobStoreForTest();
  });

  it("titleForDirectorPlan prefers plan title", () => {
    expect(titleForDirectorPlan(samplePlan("p1"))).toBe("测试计划");
  });

  it("enqueues and runs director plan sequentially", async () => {
    const ran: string[] = [];
    registerDirectorPlanJobExecutor(async (payload) => {
      ran.push(payload.plan.id);
      return { state: { planId: payload.plan.id, stepStatuses: {}, currentStepId: null, error: null }, failedStep: null };
    });

    useHermesJobStore.getState().enqueueDirectorPlan("/proj", { plan: samplePlan("a") });
    useHermesJobStore.getState().enqueueDirectorPlan("/proj", { plan: samplePlan("b") });

    await new Promise((r) => setTimeout(r, 50));

    const jobs = useHermesJobStore.getState().jobs;
    expect(ran).toEqual(["a", "b"]);
    expect(jobs.filter((j) => j.status === "done")).toHaveLength(2);
    expect(countRunningDirectorJobs(jobs, "/proj")).toBe(0);
    expect(hasActiveDirectorJobs(jobs, "/proj")).toBe(false);
  });

  it("counts queued jobs while first is running", async () => {
    let releaseFirst: (() => void) | undefined;
    registerDirectorPlanJobExecutor(
      () =>
        new Promise((resolve) => {
          if (!releaseFirst) {
            releaseFirst = () =>
              resolve({
                state: {
                  planId: "slow",
                  stepStatuses: {},
                  currentStepId: null,
                  error: null,
                },
                failedStep: null,
              });
          } else {
            resolve({
              state: {
                planId: "wait",
                stepStatuses: {},
                currentStepId: null,
                error: null,
              },
              failedStep: null,
            });
          }
        }),
    );

    useHermesJobStore.getState().enqueueDirectorPlan("/p", { plan: samplePlan("slow") });
    useHermesJobStore.getState().enqueueDirectorPlan("/p", { plan: samplePlan("wait") });

    await new Promise((r) => setTimeout(r, 10));
    const mid = useHermesJobStore.getState().jobs;
    expect(countRunningDirectorJobs(mid, "/p")).toBe(1);
    expect(countQueuedDirectorJobs(mid, "/p")).toBe(1);

    releaseFirst!();
    await new Promise((r) => setTimeout(r, 50));
    expect(useHermesJobStore.getState().jobs.every((j) => j.status === "done")).toBe(true);
  });

  it("cancels queued job immediately", async () => {
    let started = false;
    registerDirectorPlanJobExecutor(async () => {
      started = true;
      return {
        state: { planId: "x", stepStatuses: {}, currentStepId: null, error: null },
        failedStep: null,
      };
    });
    const id = useHermesJobStore.getState().enqueueDirectorPlan("/p", {
      plan: samplePlan("q"),
    });
    useHermesJobStore.getState().cancelJob(id);
    const job = useHermesJobStore.getState().jobs.find((j) => j.id === id);
    expect(job?.status).toBe("cancelled");
    await new Promise((r) => setTimeout(r, 40));
    expect(started).toBe(false);
  });

  it("cancels running job after executor returns abort state", async () => {
    let release: (() => void) | undefined;
    let jobIdCaptured = "";
    registerDirectorPlanJobExecutor(
      (_payload, jobId) =>
        new Promise((resolve) => {
          jobIdCaptured = jobId;
          release = () => {
            expect(isDirectorJobCancelRequested(jobId)).toBe(true);
            resolve({
              state: {
                planId: "run",
                stepStatuses: {},
                currentStepId: null,
                error: HERMES_JOB_CANCELLED_ERROR,
              },
              failedStep: null,
            });
          };
        }),
    );

    const id = useHermesJobStore.getState().enqueueDirectorPlan("/p", {
      plan: samplePlan("run"),
    });
    for (let i = 0; i < 20; i++) {
      const j = useHermesJobStore.getState().jobs.find((x) => x.id === id);
      if (j?.status === "running") break;
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(useHermesJobStore.getState().jobs.find((j) => j.id === id)?.status).toBe(
      "running",
    );

    useHermesJobStore.getState().cancelJob(id);
    expect(isDirectorJobCancelRequested(jobIdCaptured)).toBe(true);

    release!();
    await new Promise((r) => setTimeout(r, 30));

    const job = useHermesJobStore.getState().jobs.find((j) => j.id === id);
    expect(job?.status).toBe("cancelled");
    expect(isDirectorJobCancelRequested(id)).toBe(false);
  });

  it("runs high-priority queued job before normal", async () => {
    let releaseFirst: (() => void) | undefined;
    registerDirectorPlanJobExecutor(
      () =>
        new Promise((resolve) => {
          if (!releaseFirst) {
            releaseFirst = () =>
              resolve({
                state: {
                  planId: "block",
                  stepStatuses: {},
                  currentStepId: null,
                  error: null,
                },
                failedStep: null,
              });
          } else {
            resolve({
              state: {
                planId: "done",
                stepStatuses: {},
                currentStepId: null,
                error: null,
              },
              failedStep: null,
            });
          }
        }),
    );

    useHermesJobStore.getState().enqueueDirectorPlan("/p", { plan: samplePlan("block") });
    useHermesJobStore.getState().enqueueDirectorPlan(
      "/p",
      { plan: samplePlan("urgent") },
      undefined,
      { enqueueAtFront: true, priority: "high" },
    );

    await new Promise((r) => setTimeout(r, 15));
    releaseFirst!();
    await new Promise((r) => setTimeout(r, 60));

    const jobs = useHermesJobStore.getState().jobs;
    const done = jobs.filter((j) => j.status === "done");
    expect(done).toHaveLength(2);
    expect(done.some((j) => j.payload.plan.id === "urgent")).toBe(true);
  });

  it("cancelAllQueuedDirectorPlans clears queue", async () => {
    let release: (() => void) | undefined;
    registerDirectorPlanJobExecutor(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              state: {
                planId: "slow",
                stepStatuses: {},
                currentStepId: null,
                error: null,
              },
              failedStep: null,
            });
        }),
    );
    useHermesJobStore.getState().enqueueDirectorPlan("/p", { plan: samplePlan("slow") });
    for (let i = 0; i < 30; i++) {
      const slow = useHermesJobStore.getState().jobs.find(
        (j) => j.payload.plan.id === "slow",
      );
      if (slow?.status === "running") break;
      await new Promise((r) => setTimeout(r, 5));
    }
    useHermesJobStore.getState().enqueueDirectorPlan("/p", { plan: samplePlan("q1") });
    useHermesJobStore.getState().enqueueDirectorPlan("/p", { plan: samplePlan("q2") });
    const n = useHermesJobStore.getState().cancelAllQueuedDirectorPlans("/p");
    expect(n).toBe(2);
    release!();
    await new Promise((r) => setTimeout(r, 40));
    expect(
      useHermesJobStore.getState().jobs.filter((j) => j.payload.plan.id === "slow")[0]
        ?.status,
    ).toBe("done");
    expect(
      useHermesJobStore.getState().jobs.filter((j) => j.payload.plan.id === "q1")[0]
        ?.status,
    ).toBe("cancelled");
  });
});
