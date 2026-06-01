import { describe, expect, it } from "vitest";
import { runPool } from "@/lib/async/runPool";

describe("runPool", () => {
  it("runs at most maxConcurrent workers", async () => {
    let inFlight = 0;
    let peak = 0;
    const items = [1, 2, 3, 4, 5];

    await runPool(items, 2, async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight -= 1;
      return n * 2;
    });

    expect(peak).toBeLessThanOrEqual(2);
    expect(peak).toBeGreaterThan(1);
  });

  it("preserves result order", async () => {
    const out = await runPool([0, 1, 2], 3, async (i) => i + 10);
    expect(out).toEqual([10, 11, 12]);
  });
});
