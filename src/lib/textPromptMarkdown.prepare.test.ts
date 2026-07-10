import { normalizeTextPromptMarkdown } from "@/lib/textPromptMarkdown";
import { describe, expect, it } from "vitest";

describe("normalizeTextPromptMarkdown", () => {
  it("turns book title and sections into headings with dividers", () => {
    const input = `《替嫁千金爱上我》
人物小传
陈南
外在：高大
第一集
1-1日 外 悬崖`;
    const out = normalizeTextPromptMarkdown(input);
    expect(out).toContain("# 《替嫁千金爱上我》");
    expect(out).toContain("## 人物小传");
    expect(out).toContain("---");
    expect(out).toContain("## 第一集");
    expect(out).toContain("### 1-1日 外 悬崖");
    expect(out).toContain("**陈南**");
    expect(out).toContain("**外在：**高大");
  });

  it("bolds dialogue lines", () => {
    const out = normalizeTextPromptMarkdown("陈南：这是什么？");
    expect(out).toBe("**陈南：**这是什么？");
  });

  it("enhances mixed markdown instead of skipping", () => {
    const input = `## 第一集

1-1日 外 暴雨
**人物：**
陈南：台词`;
    const out = normalizeTextPromptMarkdown(input);
    expect(out).toContain("## 第一集");
    expect(out).toContain("### 1-1日 外 暴雨");
    expect(out).toContain("**人物：**");
    expect(out).toContain("**陈南：**台词");
  });

  it("keeps action lines with triangle as body text", () => {
    const out = normalizeTextPromptMarkdown("▲陈南站在悬崖边。");
    expect(out).toBe("▲陈南站在悬崖边。");
    expect(out).not.toContain("###");
  });

  it("fixes half-bold label lines", () => {
    const out = normalizeTextPromptMarkdown("**人物：**");
    expect(out).toBe("**人物：**");
  });
});
