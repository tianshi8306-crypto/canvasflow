import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import {
  buildHermesSituation,
  formatHermesSituationForLlm,
} from "@/lib/hermes/hermesSituation";
import type { FlowNodeData } from "@/lib/types";

function scriptNode(id: string, data: Partial<FlowNodeData> = {}): Node<FlowNodeData> {
  return {
    id,
    type: "scriptNode",
    position: { x: 0, y: 0 },
    data: { label: "脚本", ...data },
  };
}

describe("buildHermesSituation", () => {
  it("无工程时给出 block 缺口", () => {
    const s = buildHermesSituation([], [], null);
    expect(s.gaps.some((g) => g.id === "no_project")).toBe(true);
    expect(s.headline).toContain("未打开工程");
  });

  it("有工程但无脚本节点时不主动提示缺脚本", () => {
    const s = buildHermesSituation([], [], "/proj");
    expect(s.gaps.some((g) => g.id === "no_script")).toBe(false);
    expect(s.gaps.some((g) => g.id === "production_no_script_node")).toBe(false);
    expect(s.gaps).toHaveLength(0);
    expect(s.headline).toContain("可按需搭建节点");
  });

  it("空脚本节点且无梗概时不提示镜头表为空", () => {
    const nodes = [
      scriptNode("s1", { scriptBeats: [] as FlowNodeData["scriptBeats"] }),
    ];
    const s = buildHermesSituation(nodes, [], "/proj");
    expect(s.gaps.some((g) => g.id === "no_beats")).toBe(false);
    expect(s.headline).toContain("脚本节点已就绪");
  });

  it("有梗概但无镜头时仍可在 situation 中提示", () => {
    const nodes = [
      scriptNode("s1", {
        prompt: "雨夜追逐",
        scriptBeats: [] as FlowNodeData["scriptBeats"],
      }),
    ];
    const s = buildHermesSituation(nodes, [], "/proj");
    expect(s.gaps.some((g) => g.id === "no_beats")).toBe(true);
  });

  it("有分镜无图时提示缺关键帧", () => {
    const nodes = [
      scriptNode("s1", {
        scriptBeats: [
          { id: "b1", shotNumber: "1", description: "a" },
          { id: "b2", shotNumber: "2", description: "b" },
        ] as FlowNodeData["scriptBeats"],
        storyboardShots: [
          { scriptBeatId: "b1", status: "generated", visualPrompt: "雨夜" },
          { scriptBeatId: "b2", status: "generated", visualPrompt: "街道" },
        ],
      }),
    ];
    const s = buildHermesSituation(nodes, [], "/proj");
    expect(s.production.storyboardReady).toBe(2);
    expect(s.production.imageMissing).toBe(2);
    expect(s.gaps.some((g) => g.id === "image_missing")).toBe(true);
    expect(s.headline).not.toMatch(/缺.*关键帧/);
    expect(s.headline).toMatch(/分镜就绪|已有图|制片进度/);
  });

  it("formatHermesSituationForLlm 含制片字段", () => {
    const nodes = [
      scriptNode("s1", {
        prompt: "古风",
        scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
        storyboardShots: [
          { scriptBeatId: "b1", status: "generated", visualPrompt: "x" },
        ],
      }),
    ];
    const text = formatHermesSituationForLlm(buildHermesSituation(nodes, [], "/proj"));
    expect(text).toContain("关键帧");
    expect(text).toContain("梗概：已填写");
    expect(text).toContain("【全片理解】");
  });
});
