import { describe, expect, it } from "vitest";
import {
  appendImageEditPromptSuffix,
  getImageEditIntent,
  imageEditIntentParams,
} from "./imageEditIntent";

describe("imageEditIntent", () => {
  it("parses active intent from params", () => {
    expect(
      getImageEditIntent({
        params: { imageEditIntent: { active: true, subAction: "hd" } },
      }),
    ).toEqual({ active: true, subAction: "hd" });
  });

  it("builds params patch", () => {
    expect(imageEditIntentParams({ active: true, subAction: "crop" })).toEqual({
      imageEditIntent: { active: true, subAction: "crop" },
    });
  });

  it("appends edit suffix for known sub actions", () => {
    const out = appendImageEditPromptSuffix("描述", "hd");
    expect(out).toContain("清晰度");
  });
});
