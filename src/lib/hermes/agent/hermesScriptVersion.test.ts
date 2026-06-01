import { describe, expect, it } from "vitest";
import {
  formatScriptVersionList,
  summarizeScriptVersionDiff,
} from "@/lib/hermes/agent/hermesScriptVersion";

describe("hermesScriptVersion", () => {
  it("formatScriptVersionList empty", () => {
    expect(formatScriptVersionList([])).toContain("尚无");
  });

  it("summarizeScriptVersionDiff detects beat change", () => {
    const diff = summarizeScriptVersionDiff(
      { scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as never },
      {
        scriptBeats: [
          { id: "b1", shotNumber: "1", description: "a" },
          { id: "b2", shotNumber: "2", description: "b" },
        ] as never,
      },
    );
    expect(diff).toContain("镜表");
  });
});
