import { describe, expect, it } from "vitest";
import { extractLightingMoodFromStoryboardBlock } from "@/lib/scriptLightingMood";

describe("scriptLightingMood", () => {
  it("extracts labeled lighting from storyboard block", () => {
    const block = `时长：3秒
景别：全景
光影：冷色侧光，压抑疲惫
画面：崖边对峙`;
    expect(extractLightingMoodFromStoryboardBlock(block)).toBe("冷色侧光，压抑疲惫");
  });

  it("supports 光影氛围 label", () => {
    expect(
      extractLightingMoodFromStoryboardBlock("光影氛围：暖黄室内光\n画面：客厅"),
    ).toBe("暖黄室内光");
  });
});
