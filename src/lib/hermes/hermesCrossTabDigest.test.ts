import { beforeEach, describe, expect, it } from "vitest";
import {
  collectCrossTabDigestMessages,
  listStoredHermesChatTabIds,
} from "@/lib/hermes/hermesCrossTabDigest";
import {
  saveHermesChatHistory,
  type HermesChatMessage,
} from "@/lib/hermes/hermesChatHistory";

describe("hermesCrossTabDigest", () => {
  const projectPath = "/tmp/cross-tab-proj";

  beforeEach(() => {
    localStorage.clear();
  });

  it("listStoredHermesChatTabIds finds tab buckets", () => {
    saveHermesChatHistory(
      projectPath,
      [{ id: "1", role: "user", content: "hi" }],
      "tab-a",
    );
    expect(listStoredHermesChatTabIds(projectPath)).toContain("tab-a");
  });

  it("collects incremental messages from inactive tab", () => {
    saveHermesChatHistory(
      projectPath,
      [{ id: "o1", role: "user", content: "其它 tab 的话" }],
      "tab-other",
    );
    const active: HermesChatMessage[] = [
      { id: "a1", role: "user", content: "当前 tab" },
    ];
    const { messages, nextTabDigestedCounts } = collectCrossTabDigestMessages({
      projectPath,
      canvasTabs: [
        { id: "tab-main", name: "主画布" },
        { id: "tab-other", name: "分镜" },
      ],
      activeTabId: "tab-main",
      activeMessages: active,
      tabDigestedCounts: {},
    });
    expect(messages.some((m) => m.content.includes("分镜") && m.content.includes("其它"))).toBe(
      true,
    );
    expect(nextTabDigestedCounts["tab-other"]).toBe(1);
  });
});
