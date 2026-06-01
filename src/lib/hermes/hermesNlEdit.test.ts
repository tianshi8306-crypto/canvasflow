import { describe, expect, it } from "vitest";
import {
  enrichBriefStepFromMessage,
  enrichBibleStepFromMessage,
  extractNlBriefText,
  wantsNlBibleFieldEdit,
  wantsNlBriefEdit,
} from "@/lib/hermes/hermesNlEdit";
import { buildDirectorPlan } from "@/lib/hermes/hermesPlanFromIntent";
import { buildHermesCanvasContext } from "@/lib/hermes/hermesCanvasContext";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";

describe("hermesNlEdit", () => {
  it("detects brief edit intent", () => {
    expect(wantsNlBriefEdit("把梗概改成赛博朋克侦探短剧")).toBe(true);
    expect(wantsNlBriefEdit("帮我写一个故事")).toBe(false);
  });

  it("extracts brief text", () => {
    expect(extractNlBriefText("创意改为：雨夜追逐")).toContain("雨夜");
  });

  it("detects bible field edit without 圣经 keyword", () => {
    expect(wantsNlBibleFieldEdit("画风改成赛博朋克，不要出现血腥")).toBe(true);
  });

  it("enrichBriefStepFromMessage fills briefText", () => {
    const step = enrichBriefStepFromMessage(
      { id: "s", toolId: "script.update_brief", label: "x", args: {} },
      "梗概改成：都市奇幻",
    );
    expect(step.args?.briefText).toBe("都市奇幻");
  });

  it("enrichBibleStepFromMessage merges visualStyle", () => {
    const step = enrichBibleStepFromMessage(
      { id: "s", toolId: "bible.update", label: "x", args: {} },
      "视觉风格：水墨国风",
    );
    expect(step.args?.visualStyle).toBe("水墨国风");
  });
});

describe("buildDirectorPlan nl edit", () => {
  const nodes: Node<FlowNodeData>[] = [
    {
      id: "s1",
      type: "scriptNode",
      position: { x: 0, y: 0 },
      data: { label: "脚本", scriptBeats: [] },
    },
  ];

  it("plans script.update_brief for 梗概改成", () => {
    const ctx = buildHermesCanvasContext(nodes, "/proj");
    const plan = buildDirectorPlan("把梗概改成雨夜都市", ctx);
    expect(plan?.steps[0]?.toolId).toBe("script.update_brief");
    expect(plan?.steps[0]?.args?.briefText).toContain("雨夜");
  });

  it("plans bible.update for 画风改成", () => {
    const ctx = buildHermesCanvasContext(nodes, "/proj");
    const plan = buildDirectorPlan("画风改成写实纪录片", ctx);
    expect(plan?.steps[0]?.toolId).toBe("bible.update");
    expect(plan?.steps[0]?.args?.visualStyle).toContain("写实");
  });
});
