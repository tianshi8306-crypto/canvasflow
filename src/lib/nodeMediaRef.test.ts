import { describe, it, expect } from "vitest";
import { commitNodeMediaPatch, hasNodeMedia, isCanvasMediaNodeType, nodeMediaRef } from "./nodeMediaRef";

describe("nodeMediaRef", () => {
  it("hasNodeMedia accepts path or assetId", () => {
    expect(hasNodeMedia({})).toBe(false);
    expect(hasNodeMedia({ path: "assets/a.png" })).toBe(true);
    expect(hasNodeMedia({ assetId: "uuid-1" })).toBe(true);
  });

  it("nodeMediaRef trims fields", () => {
    expect(nodeMediaRef({ path: "  assets/x.mp4  ", assetId: "  id  " })).toEqual({
      path: "assets/x.mp4",
      assetId: "id",
    });
  });

  it("isCanvasMediaNodeType matches media carriers", () => {
    expect(isCanvasMediaNodeType("videoNode")).toBe(true);
    expect(isCanvasMediaNodeType("textNode")).toBe(false);
  });

  it("commitNodeMediaPatch dual-writes path and assetId", () => {
    expect(commitNodeMediaPatch("assets/a.png", "id-1")).toEqual({
      path: "assets/a.png",
      assetId: "id-1",
    });
    expect(commitNodeMediaPatch("assets/a.png", null)).toEqual({ path: "assets/a.png" });
  });
});
