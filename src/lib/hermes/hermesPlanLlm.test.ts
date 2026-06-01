import { describe, expect, it } from "vitest";
import { buildHermesCanvasContext } from "@/lib/hermes/hermesCanvasContext";
import { parseHermesLlmPlanPayload } from "@/lib/hermes/hermesPlanLlm";

describe("parseHermesLlmPlanPayload", () => {
  it("parses valid LLM JSON plan", () => {
    const ctx = buildHermesCanvasContext([], "/proj");
    const raw = JSON.stringify({
      reply: "先出分镜再出图",
      assumptions: ["按全部镜头"],
      steps: [
        { toolId: "script.generate_storyboard", label: "生成分镜" },
        { toolId: "image.generate_for_beats", label: "批量出图" },
      ],
    });
    const plan = parseHermesLlmPlanPayload(raw, "帮我把项目做成片", ctx);
    expect(plan?.plannerSource).toBe("llm");
    expect(plan?.steps).toHaveLength(2);
    expect(plan?.assumptions).toHaveLength(1);
  });

  it("returns null for empty steps", () => {
    const ctx = buildHermesCanvasContext([], "/proj");
    const raw = JSON.stringify({ reply: "这是概念解释", steps: [] });
    expect(parseHermesLlmPlanPayload(raw, "什么是分镜", ctx)).toBeNull();
  });

  it("filters unknown tool ids", () => {
    const ctx = buildHermesCanvasContext([], "/proj");
    const raw = JSON.stringify({
      steps: [
        { toolId: "magic.wand", label: "不可能" },
        { toolId: "chain.spawn_media_nodes", label: "建链" },
      ],
    });
    const plan = parseHermesLlmPlanPayload(raw, "建链", ctx);
    expect(plan?.steps).toHaveLength(1);
    expect(plan?.steps[0]?.toolId).toBe("chain.spawn_media_nodes");
  });
});
