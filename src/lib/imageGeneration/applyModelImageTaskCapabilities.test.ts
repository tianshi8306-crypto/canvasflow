import { describe, expect, it } from "vitest";
import {
  applyModelImageTaskCapabilities,
  DEFAULT_IMAGE_MODEL_CAPABILITIES,
} from "./applyModelImageTaskCapabilities";
import type { ImageGenerationContext } from "./types";

function baseCtx(overrides: Partial<ImageGenerationContext>): ImageGenerationContext {
  return {
    incomingImageRefs: [],
    resolvedRefs: [],
    aggregatedPrompt: "prompt",
    task: "multi_ref_fusion",
    referenceImagePaths: ["a.png", "b.png", "c.png"],
    blockReason: null,
    warnMessage: null,
    ...overrides,
  };
}

describe("applyModelImageTaskCapabilities", () => {
  it("passes through when model supports multi ref", () => {
    const ctx = baseCtx({});
    const next = applyModelImageTaskCapabilities(ctx, DEFAULT_IMAGE_MODEL_CAPABILITIES);
    expect(next.task).toBe("multi_ref_fusion");
    expect(next.referenceImagePaths).toEqual(["a.png", "b.png", "c.png"]);
  });

  it("downgrades multi_ref to image_to_image with first ref only", () => {
    const ctx = baseCtx({});
    const next = applyModelImageTaskCapabilities(ctx, {
      supportsMultiRefFusion: false,
      maxReferenceImages: 4,
      supportsImageEdit: true,
    });
    expect(next.task).toBe("image_to_image");
    expect(next.referenceImagePaths).toEqual(["a.png"]);
    expect(next.warnMessage).toContain("不支持多图融合");
  });

  it("truncates refs when maxReferenceImages is lower", () => {
    const ctx = baseCtx({ task: "multi_ref_fusion" });
    const next = applyModelImageTaskCapabilities(ctx, {
      supportsMultiRefFusion: true,
      maxReferenceImages: 2,
      supportsImageEdit: true,
    });
    expect(next.referenceImagePaths).toEqual(["a.png", "b.png"]);
    expect(next.warnMessage).toContain("最多使用 2 张");
  });

  it("does not change blocked context", () => {
    const ctx = baseCtx({ blockReason: "blocked", task: null });
    const next = applyModelImageTaskCapabilities(ctx, {
      supportsMultiRefFusion: false,
      maxReferenceImages: 1,
      supportsImageEdit: true,
    });
    expect(next).toBe(ctx);
  });

  it("blocks image_edit when model does not support edit", () => {
    const ctx = baseCtx({ task: "image_edit", referenceImagePaths: ["self.png"] });
    const next = applyModelImageTaskCapabilities(ctx, {
      supportsMultiRefFusion: true,
      maxReferenceImages: 4,
      supportsImageEdit: false,
    });
    expect(next.blockReason).toContain("图像编辑");
    expect(next.task).toBeNull();
  });
});
