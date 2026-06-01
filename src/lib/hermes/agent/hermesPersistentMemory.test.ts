import { describe, expect, it } from "vitest";
import {
  dedupeMemoryFacts,
  formatHermesMemoryForPrompt,
  parseMemoryFactTag,
  searchHermesMemoryFacts,
  type HermesPersistentMemory,
} from "@/lib/hermes/agent/hermesPersistentMemory";

function memory(facts: string[]): HermesPersistentMemory {
  return {
    version: 1,
    userProfile: "竖屏短视频",
    facts: facts.map((text, i) => ({
      id: String(i),
      text,
      source: "user" as const,
      createdAt: new Date().toISOString(),
    })),
    updatedAt: new Date().toISOString(),
  };
}

describe("hermesPersistentMemory M4", () => {
  it("parseMemoryFactTag recognizes proc and reflect", () => {
    expect(parseMemoryFactTag("[proc:a>b] ok")).toBe("procedure");
    expect(parseMemoryFactTag("[reflect] lesson")).toBe("reflect");
    expect(parseMemoryFactTag("[pref:] 竖屏")).toBe("pref");
  });

  it("searchHermesMemoryFacts matches CJK tokens", () => {
    const m = memory(["记住：女主服装偏冷色", "[proc:x] 出图流程"]);
    const hits = searchHermesMemoryFacts(m, "女主 冷色");
    expect(hits.some((h) => h.text.includes("冷色"))).toBe(true);
  });

  it("formatHermesMemoryForPrompt groups by tag", () => {
    const m = memory(["[proc:a] 流程", "[reflect] 复盘要点"]);
    const block = formatHermesMemoryForPrompt(m);
    expect(block).toContain("用户画像");
    expect(block).toContain("成功流程");
    expect(block).toContain("任务复盘");
  });

  it("dedupeMemoryFacts removes prefix duplicates", () => {
    const facts = [
      { id: "1", text: "相同记忆", source: "user" as const, createdAt: "" },
      { id: "2", text: "相同记忆", source: "agent" as const, createdAt: "" },
    ];
    expect(dedupeMemoryFacts(facts)).toHaveLength(1);
  });
});
