import { describe, expect, it } from "vitest";
import {
  applyExportFormatToPath,
  defaultExportRelPath,
  exportFormatFromOutputPath,
  exportFormatSupportsBitrate,
  parseExportFormatFromMessage,
  resolveExportFormat,
} from "@/lib/compose/timelineExportFormat";

describe("timelineExportFormat", () => {
  it("detects format from output path", () => {
    expect(exportFormatFromOutputPath("assets/exports/final.webm")).toBe("webm");
    expect(exportFormatFromOutputPath("out.mov")).toBe("mov");
    expect(exportFormatFromOutputPath("anim.gif")).toBe("gif");
    expect(exportFormatFromOutputPath("x.unknown")).toBe("mp4");
  });

  it("resolveExportFormat prefers node exportFormat over path", () => {
    expect(
      resolveExportFormat({ exportFormat: "prores", output: "x.mov" }, "x.mov"),
    ).toBe("prores");
    expect(resolveExportFormat({}, "final.gif")).toBe("gif");
  });

  it("replaces extension while keeping directory and stem", () => {
    expect(applyExportFormatToPath("assets/exports/demo.mp4", "webm")).toBe(
      "assets/exports/demo.webm",
    );
    expect(applyExportFormatToPath("assets/exports/demo.mp4", "prores")).toBe(
      "assets/exports/demo.mov",
    );
    expect(applyExportFormatToPath("assets/exports/demo.mp4", "gif")).toBe(
      "assets/exports/demo.gif",
    );
  });

  it("parses format from user message", () => {
    expect(parseExportFormatFromMessage("导出 webm 成片")).toBe("webm");
    expect(parseExportFormatFromMessage("导出 ProRes")).toBe("prores");
    expect(parseExportFormatFromMessage("导出 gif 动图")).toBe("gif");
    expect(parseExportFormatFromMessage("导出成片")).toBeUndefined();
  });

  it("default path per format", () => {
    expect(defaultExportRelPath("mov")).toBe("assets/exports/final.mov");
    expect(defaultExportRelPath("gif")).toBe("assets/exports/final.gif");
  });

  it("gif does not support bitrate presets", () => {
    expect(exportFormatSupportsBitrate("gif")).toBe(false);
    expect(exportFormatSupportsBitrate("mp4")).toBe(true);
  });
});
