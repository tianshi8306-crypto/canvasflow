import { describe, expect, it } from "vitest";
import {
  computeScriptVersionVisualDiff,
  filterScriptVersionDiffRows,
  formatScriptVersionVisualDiffSummary,
} from "@/lib/hermes/agent/hermesScriptVersionDiff";

describe("hermesScriptVersionDiff", () => {
  it("detects added beat and changed description", () => {
    const diff = computeScriptVersionVisualDiff(
      {
        scriptBeats: [
          { id: "b1", shotNumber: "1", description: "日景", dialogue: "" },
        ] as never,
      },
      {
        scriptBeats: [
          { id: "b1", shotNumber: "1", description: "夜景", dialogue: "" },
          { id: "b2", shotNumber: "2", description: "新镜", dialogue: "" },
        ] as never,
      },
    );
    expect(diff.stats.beatsAdded).toBe(1);
    expect(diff.stats.beatsChanged).toBe(1);
    const changed = filterScriptVersionDiffRows(diff.beatRows).find((r) => r.key === "b1");
    expect(changed?.fields.some((f) => f.field === "description")).toBe(true);
    expect(formatScriptVersionVisualDiffSummary(diff)).toContain("镜表");
  });

  it("detects brief change", () => {
    const diff = computeScriptVersionVisualDiff(
      { prompt: "旧梗概" },
      { prompt: "新梗概" },
    );
    expect(diff.briefChanged).toBe(true);
    expect(formatScriptVersionVisualDiffSummary(diff)).toContain("梗概");
  });
});
