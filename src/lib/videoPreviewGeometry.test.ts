import { describe, expect, it } from "vitest";
import {
  contentPxToNormalizedRegion,
  getVideoContentRect,
  normalizedRegionToContentPx,
} from "./videoPreviewGeometry";

describe("getVideoContentRect", () => {
  it("letterboxes 16:9 video in square container", () => {
    const content = getVideoContentRect(400, 400, 1920, 1080);
    expect(content.width).toBe(400);
    expect(content.height).toBeCloseTo(225, 0);
    expect(content.top).toBeCloseTo(87.5, 0);
    expect(content.left).toBe(0);
  });
});

describe("region roundtrip", () => {
  it("normalized to px and back", () => {
    const content = getVideoContentRect(500, 300, 1280, 720);
    const region = { x: 0.1, y: 0.8, w: 0.8, h: 0.15 };
    const px = normalizedRegionToContentPx(region, content);
    const back = contentPxToNormalizedRegion(px, content);
    expect(back.x).toBeCloseTo(region.x, 3);
    expect(back.y).toBeCloseTo(region.y, 3);
    expect(back.w).toBeCloseTo(region.w, 3);
    expect(back.h).toBeCloseTo(region.h, 3);
  });
});
