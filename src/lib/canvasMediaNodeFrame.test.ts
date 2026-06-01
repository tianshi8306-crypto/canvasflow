import { describe, expect, it } from "vitest";
import { computeCanvasMediaNodeFrameSize, CANVAS_MEDIA_NODE_MAX_EDGE } from "./canvasMediaNodeFrame";
import { computeImageNodeFrameSize } from "@/lib/imageGeneration/imageAspectSize";
import { computeVideoNodeFrameSize } from "@/lib/videoGeneration/videoAspectSize";

describe("canvasMediaNodeFrame", () => {
  it("16:9 uses 500px long edge", () => {
    const frame = computeCanvasMediaNodeFrameSize(16 / 9);
    expect(frame).toEqual({ width: 500, height: 281 });
  });

  it("image and video share the same frame at 16:9", () => {
    const ratio = 16 / 9;
    expect(computeImageNodeFrameSize(ratio)).toEqual(computeVideoNodeFrameSize(ratio));
    expect(computeImageNodeFrameSize(ratio).width).toBe(CANVAS_MEDIA_NODE_MAX_EDGE);
  });
});
