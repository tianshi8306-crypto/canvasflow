import { describe, expect, it } from "vitest";
import {
  exportEncodeNeedsReencode,
  exportEncodeToInvokePayload,
  normalizeExportEncode,
} from "@/lib/compose/timelineExportEncode";

describe("timelineExportEncode", () => {
  it("defaults to source + auto bitrate", () => {
    const s = normalizeExportEncode({});
    expect(s.resolution).toBe("source");
    expect(s.videoBitrateKbps).toBe(0);
    expect(exportEncodeNeedsReencode(s)).toBe(false);
    expect(exportEncodeToInvokePayload(s)).toBeUndefined();
  });

  it("1080p triggers invoke payload", () => {
    const s = normalizeExportEncode({
      exportEncode: { resolution: "1080p", videoBitrateKbps: 4000 },
    });
    expect(exportEncodeNeedsReencode(s)).toBe(true);
    expect(exportEncodeToInvokePayload(s)).toEqual({
      resolution: "1080p",
      videoBitrateKbps: 4000,
    });
  });
});
