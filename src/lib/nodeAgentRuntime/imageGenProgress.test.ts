import { describe, expect, it, vi } from "vitest";
import { startImageGenProgressTicker } from "./imageGenProgress";

describe("startImageGenProgressTicker", () => {
  it("updates node status progress over time", () => {
    vi.useFakeTimers();
    const updates: number[] = [];
    const stop = startImageGenProgressTicker({
      nodeId: "n1",
      projectPath: "/p",
      updateNodeData: (_id, patch) => {
        const p = patch.status?.progress;
        if (typeof p === "number") updates.push(p);
      },
      setStatusText: () => {},
    });

    vi.advanceTimersByTime(1200);
    stop();
    vi.useRealTimers();

    expect(updates.length).toBeGreaterThan(1);
    expect(updates[0]).toBe(8);
    expect(updates.at(-1)).toBeGreaterThan(updates[0]!);
  });
});
