import { describe, expect, it } from "vitest";
import {
  composerUploadHasBlock,
  formatHermesComposerUploadAck,
} from "@/lib/hermes/hermesComposerUpload";
import type { ScriptDocumentAnalysis } from "@/lib/scriptDocument/scriptDocumentGaps";

const extract = {
  fileName: "demo.txt",
  format: "txt",
  text: "hello",
  charCount: 5,
};

const analysis: ScriptDocumentAnalysis = {
  charCount: 1200,
  lineCount: 40,
  estimatedSceneMarkers: 2,
  gaps: [
    { id: "no_scene", severity: "info", message: "无场次标记" },
    { id: "warn1", severity: "warn", message: "空行较多" },
  ],
  importText: "x".repeat(1200),
  truncated: false,
};

describe("hermesComposerUpload", () => {
  it("formatHermesComposerUploadAck is short and mentions no auto write", () => {
    const ack = formatHermesComposerUploadAck(extract, analysis);
    expect(ack).toContain("demo.txt");
    expect(ack).toContain("1,200");
    expect(ack).toContain("未写入画布");
    expect(ack.length).toBeLessThanOrEqual(160);
  });

  it("composerUploadHasBlock respects block gaps", () => {
    expect(composerUploadHasBlock(analysis)).toBe(false);
    expect(
      composerUploadHasBlock({
        ...analysis,
        gaps: [{ id: "too_short", severity: "block", message: "过短" }],
      }),
    ).toBe(true);
  });
});
