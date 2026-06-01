import { describe, expect, it } from "vitest";
import { runCoalescedProjectSave } from "@/store/projectSaveRunner";

describe("runCoalescedProjectSave", () => {
  it("coalesces overlapping saves into one follow-up", async () => {
    let runs = 0;
    const run = async () => {
      runs += 1;
      if (runs === 1) {
        await runCoalescedProjectSave(run);
      }
    };
    await runCoalescedProjectSave(run);
    expect(runs).toBe(2);
  });
});
