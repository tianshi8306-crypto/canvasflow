import { describe, expect, it } from "vitest";
import { extractBiblePatchFromMessage } from "@/lib/hermes/hermesTools/bibleUpdateTool";

describe("extractBiblePatchFromMessage", () => {
  it("extracts visual style", () => {
    expect(extractBiblePatchFromMessage("把视觉风格改成赛博朋克霓虹")).toEqual({
      visualStyle: "赛博朋克霓虹",
    });
  });

  it("extracts duration", () => {
    expect(extractBiblePatchFromMessage("目标时长 45 秒")).toEqual({
      targetDurationSec: 45,
    });
  });
});
