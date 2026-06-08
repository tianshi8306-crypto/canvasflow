import { describe, expect, it } from "vitest";
import {
  MAX_VIDEO_JOB_WALL_CLOCK_MS,
  shouldFailVideoJobAsStuck,
} from "./videoJobStuckDetection";

describe("shouldFailVideoJobAsStuck", () => {
  const started = 1_000_000;

  it("does not fail when progress is missing (typical Dreamina/Seedance polls)", () => {
    let state: ReturnType<typeof shouldFailVideoJobAsStuck>["next"] | undefined;
    for (let i = 0; i < 200; i += 1) {
      const r = shouldFailVideoJobAsStuck({
        prev: state,
        status: "running",
        progress: undefined,
        jobStartedAtMs: started,
        nowMs: started + i * 500,
      });
      expect(r.fail).toBe(false);
      state = r.next;
    }
  });

  it("fails when numeric progress plateaus for too many polls", () => {
    let state: ReturnType<typeof shouldFailVideoJobAsStuck>["next"] | undefined;
    let failed = false;
    for (let i = 0; i < 80; i += 1) {
      const r = shouldFailVideoJobAsStuck({
        prev: state,
        status: "running",
        progress: 42,
        jobStartedAtMs: started,
        nowMs: started + i * 500,
      });
      state = r.next;
      if (r.fail) {
        failed = true;
        break;
      }
    }
    expect(failed).toBe(true);
  });

  it("fails after wall-clock timeout even without progress", () => {
    const r = shouldFailVideoJobAsStuck({
      prev: undefined,
      status: "running",
      progress: undefined,
      jobStartedAtMs: started,
      nowMs: started + MAX_VIDEO_JOB_WALL_CLOCK_MS + 1,
    });
    expect(r.fail).toBe(true);
  });

  it("resets plateau counter when status changes", () => {
    const first = shouldFailVideoJobAsStuck({
      prev: undefined,
      status: "queued",
      progress: 0,
      jobStartedAtMs: started,
      nowMs: started + 100,
    });
    const second = shouldFailVideoJobAsStuck({
      prev: first.next,
      status: "running",
      progress: 0,
      jobStartedAtMs: started,
      nowMs: started + 200,
    });
    expect(second.next.progressPlateauPolls).toBe(0);
  });
});
