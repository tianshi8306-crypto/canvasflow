import { describe, expect, it } from "vitest";
import { resolveHermesChatMediaPreview } from "@/lib/hermes/hermesChatMediaPreview";

describe("hermesChatMediaPreview", () => {
  it("uses explicit preview when provided", () => {
    expect(
      resolveHermesChatMediaPreview({
        ok: true,
        message: "ok",
        explicit: { kind: "video", assetRelPath: "assets/out.mp4" },
      }),
    ).toEqual({ kind: "video", assetRelPath: "assets/out.mp4" });
  });

  it("parses asset path from compose export message", () => {
    expect(
      resolveHermesChatMediaPreview({
        toolId: "compose.export_script",
        ok: true,
        message: "成片已导出：assets/renders/final.mp4（3 段）",
      }),
    ).toEqual({ kind: "video", assetRelPath: "assets/renders/final.mp4" });
  });

  it("skips failed steps and non-media tools", () => {
    expect(
      resolveHermesChatMediaPreview({
        toolId: "canvas.ensure_script",
        ok: true,
        message: "已创建脚本节点",
      }),
    ).toBeUndefined();
    expect(
      resolveHermesChatMediaPreview({
        toolId: "compose.export_script",
        ok: false,
        message: "成片已导出：assets/x.mp4",
      }),
    ).toBeUndefined();
  });
});
