import { describe, expect, it } from "vitest";
import {
  formatHermesWorkstateForPrompt,
  type HermesWorkstate,
} from "@/lib/hermes/agent/hermesWorkstate";

describe("hermesWorkstate", () => {
  it("formatHermesWorkstateForPrompt includes long context blocks", () => {
    const ws: HermesWorkstate = {
      version: 1,
      activeJobs: [],
      projectContextSummary: "梗概：雨夜",
      conversationDigest: "用户：出图",
      userConstraints: ["竖屏 9:16"],
      updatedAt: new Date().toISOString(),
    };
    const text = formatHermesWorkstateForPrompt(ws);
    expect(text).toContain("工程上下文摘要");
    expect(text).toContain("较早对话摘要");
    expect(text).toContain("竖屏");
  });

  it("formatHermesWorkstateForPrompt includes goal and active jobs", () => {
    const ws: HermesWorkstate = {
      version: 1,
      currentGoal: "1-6 镜出图",
      activeJobs: [
        { id: "j1", title: "批量出图", status: "running" },
        { id: "j2", title: "补分镜", status: "queued" },
      ],
      updatedAt: new Date().toISOString(),
    };
    const text = formatHermesWorkstateForPrompt(ws);
    expect(text).toContain("当前制片目标");
    expect(text).toContain("批量出图");
    expect(text).toContain("queued");
  });
});
