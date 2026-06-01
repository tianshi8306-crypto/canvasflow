import { describe, it, expect, beforeEach } from "vitest";
import { buildCanvasGenFailureSuggestion } from "@/lib/hermes/notifyHermesCanvasGenFailure";
import { useHermesOrbSuggestStore } from "@/store/hermesOrbSuggestStore";

describe("notifyHermesCanvasGenFailure", () => {
  beforeEach(() => {
    useHermesOrbSuggestStore.getState().reset();
  });

  it("builds humanized orb suggestion for expired task", () => {
    const s = buildCanvasGenFailureSuggestion({
      nodeId: "n1",
      kind: "video",
      error: "任务不存在 (可能已过期)",
      nodeLabel: "镜头 1",
    });
    expect(s.message).toContain("镜头 1");
    expect(s.message).toContain("任务不存在");
    expect(s.actionLabel).toBe("让 H 排查");
    expect(s.actionPrompt).toContain("任务不存在");
  });
});
