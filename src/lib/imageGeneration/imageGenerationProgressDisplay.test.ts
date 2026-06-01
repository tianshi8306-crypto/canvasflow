import { describe, expect, it } from "vitest";
import {
  getImageGenerationDisplayLabel,
  getImageGenerationProgressPercent,
  isImageGenerationInProgress,
} from "./imageGenerationProgressDisplay";

describe("getImageGenerationProgressPercent", () => {
  it("returns undefined when no progress", () => {
    expect(getImageGenerationProgressPercent({ status: "running", progress: undefined })).toBeUndefined();
  });

  it("accepts ticker percent 0-99", () => {
    expect(getImageGenerationProgressPercent({ status: "running", progress: 42 })).toBe(42);
  });

  it("normalizes API fractions", () => {
    expect(getImageGenerationProgressPercent({ status: "running", progress: 0.42 })).toBe(42);
  });
});

describe("getImageGenerationDisplayLabel", () => {
  it("shows phase text without fake percent", () => {
    expect(getImageGenerationDisplayLabel({ status: "pending" })).toBe("准备中…");
    expect(getImageGenerationDisplayLabel({ status: "running" })).toBe("正在生成图片…");
  });

  it("shows percent when progress is present", () => {
    expect(getImageGenerationDisplayLabel({ status: "running", progress: 24 })).toBe(
      "正在生成图片 24%…",
    );
  });

  it("shows stopping label", () => {
    expect(getImageGenerationDisplayLabel({ status: "running", cancelling: true })).toBe("停止中…");
  });
});

describe("isImageGenerationInProgress", () => {
  it("detects active generation", () => {
    expect(isImageGenerationInProgress({ status: "pending" })).toBe(true);
    expect(isImageGenerationInProgress({ status: "running" })).toBe(true);
    expect(isImageGenerationInProgress({ status: "succeeded" })).toBe(false);
    expect(isImageGenerationInProgress({ status: "failed", cancelling: true })).toBe(true);
  });
});
