import { describe, expect, it } from "vitest";
import {
  isAwaitingNewVideoResult,
  nodeHasLocalVideo,
  nodeHasSatisfiedLocalVideo,
} from "./videoNodeLocalSatisfaction";

describe("videoNodeLocalSatisfaction", () => {
  it("treats path/assetId as local video", () => {
    expect(nodeHasLocalVideo({ path: "assets/video/a.mp4" })).toBe(true);
    expect(nodeHasLocalVideo({ assetId: "abc" })).toBe(true);
    expect(nodeHasLocalVideo({ assetId: "abc", path: "" })).toBe(true);
  });

  it("satisfied when local video and not awaiting replacement", () => {
    expect(
      nodeHasSatisfiedLocalVideo({
        path: "assets/video/a.mp4",
        video: { awaitingNewResult: false },
      }),
    ).toBe(true);
    expect(
      nodeHasSatisfiedLocalVideo({
        path: "assets/video/a.mp4",
        video: { awaitingNewResult: true },
      }),
    ).toBe(false);
  });

  it("isAwaitingNewVideoResult reads flag", () => {
    expect(isAwaitingNewVideoResult({ awaitingNewResult: true })).toBe(true);
  });
});
