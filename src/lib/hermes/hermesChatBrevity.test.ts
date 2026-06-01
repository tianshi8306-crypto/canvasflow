import { describe, expect, it } from "vitest";
import {
  formatPlanStepsForChat,
  stripHermesChatBoilerplate,
} from "@/lib/hermes/hermesChatBrevity";
import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";

describe("hermesChatBrevity", () => {
  it("single rule step omits intro", () => {
    const plan: HermesDirectorPlan = {
      id: "1",
      title: "t",
      sourceMessage: "x",
      plannerSource: "rules",
      steps: [{ id: "s", toolId: "canvas.add_text_node", label: "在画布上创建文本节点" }],
    };
    expect(formatPlanStepsForChat(plan)).toBe("1. 在画布上创建文本节点");
  });

  it("detailed style keeps longer planner reply", () => {
    const longReply = "x".repeat(100);
    const plan: HermesDirectorPlan = {
      id: "2",
      title: "t",
      sourceMessage: "请解释一下蒙太奇在悬疑片里怎么用？",
      plannerSource: "llm",
      plannerReply: longReply,
      steps: [
        { id: "a", toolId: "canvas.add_text_node", label: "一步" },
        { id: "b", toolId: "canvas.ensure_script", label: "二步" },
      ],
    };
    const out = formatPlanStepsForChat(plan, {
      style: "detailed",
      messageMode: "consult",
    });
    expect(out).toContain("x".repeat(100));
  });

  it("strips fake operation result boilerplate", () => {
    const raw =
      "已确认你的指令。现在正在执行。\n\n**操作结果：**\n- 已创建文本节点\n\n如果还需要随时告诉我。";
    expect(stripHermesChatBoilerplate(raw)).not.toMatch(/操作结果/);
    expect(stripHermesChatBoilerplate(raw)).not.toMatch(/随时告诉我/);
  });
});
