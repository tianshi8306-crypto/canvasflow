import { describe, expect, it } from "vitest";
import { applyMarkdownFormat } from "./textPromptMarkdown";

describe("applyMarkdownFormat", () => {
  it("wraps selection in bold markers", () => {
    const r = applyMarkdownFormat("hello world", 0, 5, "bold");
    expect(r.text).toBe("**hello** world");
  });

  it("prefixes heading on current line", () => {
    const r = applyMarkdownFormat("标题\n正文", 0, 0, "formatBlock", "h2");
    expect(r.text).toBe("## 标题\n正文");
  });

  it("inserts horizontal rule", () => {
    const r = applyMarkdownFormat("上", 1, 1, "insertHorizontalRule");
    expect(r.text).toContain("---");
  });

  it("clears heading prefix on current line", () => {
    const r = applyMarkdownFormat("## 标题\n正文", 3, 3, "clearFormat");
    expect(r.text).toBe("标题\n正文");
  });

  it("strips bold markers from selection", () => {
    const r = applyMarkdownFormat("**加粗**", 0, 6, "clearFormat");
    expect(r.text).toBe("加粗");
  });
});
