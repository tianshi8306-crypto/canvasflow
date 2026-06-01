import { describe, expect, it } from "vitest";
import {
  formatCanvasReferentForPrompt,
  isCanvasReferentFresh,
  mergeCanvasReferent,
  referentFromPlanBeatIds,
} from "@/lib/hermes/agent/hermesCanvasReferent";

describe("hermesCanvasReferent", () => {
  it("referentFromPlanBeatIds", () => {
    const r = referentFromPlanBeatIds([3, 4]);
    expect(r?.shotNumber).toBe("3");
    expect(r?.source).toBe("plan");
  });

  it("mergeCanvasReferent keeps newer", () => {
    const older = {
      shotNumber: "1",
      source: "selection" as const,
      at: "2020-01-01T00:00:00.000Z",
    };
    const newer = {
      shotNumber: "2",
      source: "tool" as const,
      at: new Date().toISOString(),
    };
    expect(mergeCanvasReferent(older, newer)?.shotNumber).toBe("2");
  });

  it("formatCanvasReferentForPrompt respects TTL", () => {
    const stale = {
      shotNumber: "1",
      source: "tool" as const,
      at: "2020-01-01T00:00:00.000Z",
    };
    expect(isCanvasReferentFresh(stale)).toBe(false);
    expect(formatCanvasReferentForPrompt(stale)).toBe("");
  });
});
