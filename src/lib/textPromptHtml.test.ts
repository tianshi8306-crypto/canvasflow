import { describe, expect, it } from "vitest";
import { htmlToMarkdown, markdownToHtml } from "./textPromptHtml";

describe("textPromptHtml", () => {
  it("renders headings and bold in html", () => {
    const html = markdownToHtml("## 第一集\n\n**陈南：**你好");
    expect(html).toContain("<h2>");
    expect(html).toContain("<strong>");
  });

  it("round-trips screenplay lines", () => {
    const source = "## 第一集\n\n### 1-1 外 悬崖\n\n**陈南：**台词";
    const back = htmlToMarkdown(markdownToHtml(source));
    expect(back).toContain("## 第一集");
    expect(back).toContain("### 1-1");
    expect(back).toContain("**陈南：**");
  });
});
