import { describe, it, expect } from "vitest";
import { defaultVideoGenerationDraft } from "@/lib/videoNodeTypes";
import { formatVideoDraftInspectorSummary } from "./videoInspectorSummary";

describe("formatVideoDraftInspectorSummary", () => {
  it("formats draft as readable one-liner", () => {
    const draft = defaultVideoGenerationDraft();
    draft.modelId = "doubao_seedance_2_0";
    draft.output.aspectRatio = "9:16";
    draft.output.durationSec = 5;
    draft.output.generateAudio = true;
    expect(formatVideoDraftInspectorSummary(draft, "Doubao Seedance 2.0")).toBe(
      "Seedance 2.0 · 9:16 · 5s · 有音频",
    );
  });

  it("includes noSubtitles when enabled", () => {
    const draft = defaultVideoGenerationDraft();
    draft.output.noSubtitles = true;
    expect(formatVideoDraftInspectorSummary(draft)).toContain("去字幕");
  });
});
