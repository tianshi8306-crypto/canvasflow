import { describe, expect, it } from "vitest";
import {
  getVideoGenerationDisplayLabel,
  getVideoGenerationProgressPercent,
  isVideoGenerationInProgress,
} from "./videoGenerationProgressDisplay";

describe("getVideoGenerationProgressPercent", () => {
  it("returns undefined when no backend progress", () => {
    expect(getVideoGenerationProgressPercent({ status: "running", progress: undefined })).toBeUndefined();
    expect(getVideoGenerationProgressPercent({ status: "running", progress: null })).toBeUndefined();
  });

  it("normalizes API fractions", () => {
    expect(getVideoGenerationProgressPercent({ status: "running", progress: 0.42 })).toBe(42);
  });
});

describe("getVideoGenerationDisplayLabel", () => {
  it("shows phase text without fake percent", () => {
    expect(getVideoGenerationDisplayLabel({ status: "queued" })).toBe("排队中…");
    expect(getVideoGenerationDisplayLabel({ status: "running" })).toBe("生成中…");
  });

  it("shows percent only when progress is present", () => {
    expect(getVideoGenerationDisplayLabel({ status: "running", progress: 0.02 })).toBe("生成中 2%…");
    expect(getVideoGenerationDisplayLabel({ status: "queued", progress: 15 })).toBe("排队中 15%…");
  });

  it("shows cancelling label", () => {
    expect(getVideoGenerationDisplayLabel({ status: "running", cancelling: true })).toBe("取消中…");
  });

  it("shows submitting label before job is queued", () => {
    expect(getVideoGenerationDisplayLabel({ submitting: true })).toBe("提交中…");
  });
});

describe("isVideoGenerationInProgress", () => {
  it("detects active jobs", () => {
    expect(isVideoGenerationInProgress({ status: "queued" })).toBe(true);
    expect(isVideoGenerationInProgress({ status: "running" })).toBe(true);
    expect(isVideoGenerationInProgress({ status: "succeeded" })).toBe(false);
    expect(isVideoGenerationInProgress({ status: "failed", cancelling: true })).toBe(true);
    expect(isVideoGenerationInProgress({ submitting: true })).toBe(true);
  });
});
