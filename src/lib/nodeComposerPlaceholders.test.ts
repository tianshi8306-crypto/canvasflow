import { describe, expect, it } from "vitest";
import {
  buildComposerPlaceholder,
  imageGenPromptPlaceholder,
  SCRIPT_COMPOSER_PLACEHOLDER,
  TEXT_COMPOSER_PLACEHOLDER_DEFAULT,
  videoGenPromptPlaceholder,
} from "./nodeComposerPlaceholders";

describe("nodeComposerPlaceholders", () => {
  it("buildComposerPlaceholder adds @ and / only when requested", () => {
    expect(buildComposerPlaceholder("写提示词")).toBe("写提示词…");
    expect(buildComposerPlaceholder("写提示词", { at: true })).toBe("写提示词… @ 引用上游");
    expect(buildComposerPlaceholder("写提示词", { slash: true })).toBe("写提示词… / 呼出指令");
    expect(buildComposerPlaceholder("写提示词", { at: true, slash: true })).toBe(
      "写提示词… @ 引用上游，/ 呼出指令",
    );
  });

  it("text default mentions @ only", () => {
    expect(TEXT_COMPOSER_PLACEHOLDER_DEFAULT).toContain("@ 引用上游");
    expect(TEXT_COMPOSER_PLACEHOLDER_DEFAULT).not.toContain("/");
  });

  it("script mentions both @ and /", () => {
    expect(SCRIPT_COMPOSER_PLACEHOLDER).toContain("@ 引用上游");
    expect(SCRIPT_COMPOSER_PLACEHOLDER).toContain("/ 呼出指令");
  });

  it("image and video placeholders vary by ref bar", () => {
    expect(imageGenPromptPlaceholder(false)).toContain("/ 呼出指令");
    expect(imageGenPromptPlaceholder(true)).toContain("@文本1");
    expect(videoGenPromptPlaceholder(false)).not.toContain("@");
    expect(videoGenPromptPlaceholder(true)).toContain("@文本1");
    expect(videoGenPromptPlaceholder(false)).not.toContain("/");
  });
});
