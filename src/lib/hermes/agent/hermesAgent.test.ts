import { describe, expect, it } from "vitest";
import {
  formatHermesMemoryForPrompt,
  searchHermesMemoryFacts,
  type HermesPersistentMemory,
} from "@/lib/hermes/agent/hermesPersistentMemory";
import { parseAutomationFromMessage } from "@/lib/hermes/agent/hermesAutomation";
import { splitBeatIdsForParallel } from "@/lib/hermes/agent/hermesSubagent";
import { resolveHermesAgentChatIntent } from "@/lib/hermes/agent/hermesAgentChat";
import { mcpNameToToolId } from "@/lib/hermes/agent/hermesCanvasMcp";

describe("hermesAgent", () => {
  it("memory search", () => {
    const memory: HermesPersistentMemory = {
      version: 1,
      userProfile: "偏好赛博朋克",
      facts: [{ id: "1", text: "女主服装冷色", source: "user", createdAt: "" }],
      updatedAt: "",
    };
    const hits = searchHermesMemoryFacts(memory, "女主 服装");
    expect(hits.length).toBeGreaterThan(0);
    expect(formatHermesMemoryForPrompt(memory, "女主")).toContain("冷色");
  });

  it("automation parse", () => {
    const p = parseAutomationFromMessage("每 30 分钟检查流程并汇报");
    expect(p?.intervalMinutes).toBe(30);
  });

  it("parallel beat split", () => {
    const groups = splitBeatIdsForParallel([1, 2, 3, 4, 5], 3);
    expect(groups.length).toBeGreaterThan(1);
  });

  it("agent chat intents", () => {
    expect(resolveHermesAgentChatIntent("我的记忆")).toBe("list_memory");
    expect(resolveHermesAgentChatIntent("有哪些 skills")).toBe("list_skills");
    expect(resolveHermesAgentChatIntent("脚本版本")).toBe("list_script_versions");
    expect(resolveHermesAgentChatIntent("回滚脚本")).toBe("rollback_script_version");
    expect(resolveHermesAgentChatIntent("版本对比")).toBe("compare_script_versions");
    expect(resolveHermesAgentChatIntent("取消第 2 镜出图")).toBe("cancel_jobs_nl");
    expect(resolveHermesAgentChatIntent("取消全部排队")).toBe("cancel_queued_jobs");
  });

  it("mcp name maps to tool", () => {
    expect(mcpNameToToolId("image_generate_for_beats")).toBe(
      "image.generate_for_beats",
    );
  });
});
