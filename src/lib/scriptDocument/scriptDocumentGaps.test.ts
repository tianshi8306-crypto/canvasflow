import { describe, expect, it } from "vitest";
import { analyzeScriptDocument } from "@/lib/scriptDocument/scriptDocumentGaps";

describe("analyzeScriptDocument", () => {
  it("过短正文给出 block", () => {
    const a = analyzeScriptDocument("短");
    expect(a.gaps.some((g) => g.id === "too_short")).toBe(true);
  });

  it("检测场次标记", () => {
    const text = "第1场\n内景 客厅\n角色A说：你好\n".repeat(5);
    const a = analyzeScriptDocument(text);
    expect(a.estimatedSceneMarkers).toBeGreaterThan(0);
    expect(a.gaps.some((g) => g.id === "too_short")).toBe(false);
  });

  it("超长正文标记截断", () => {
    const text = "第1场\n" + "对白内容一行较长用于测试截断。\n".repeat(4000);
    const a = analyzeScriptDocument(text);
    expect(a.truncated).toBe(true);
    expect(a.importText.length).toBeLessThanOrEqual(48_000);
  });
});
