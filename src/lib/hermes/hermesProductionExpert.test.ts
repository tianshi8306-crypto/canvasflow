import { describe, expect, it } from "vitest";
import { buildHermesSituation } from "@/lib/hermes/hermesSituation";
import {
  buildKnowledgeQueryFromSituation,
  formatHermesExpertDoctrineForLlm,
  pickKnowledgeScenesFromSituation,
} from "@/lib/hermes/hermesProductionExpert";
import { formatHermesSituationForLlm } from "@/lib/hermes/hermesSituation";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";

describe("hermesProductionExpert", () => {
  it("situation 摘要包含专家身份块", () => {
    const text = formatHermesSituationForLlm(buildHermesSituation([], [], "/proj"));
    expect(text).toContain("制片专家");
    expect(formatHermesExpertDoctrineForLlm()).toContain("非线性");
  });

  it("无脚本时检索场景含 workflow", () => {
    const situation = buildHermesSituation([], [], "/proj");
    expect(pickKnowledgeScenesFromSituation(situation)).toContain("workflow");
  });

  it("视频失败时检索 troubleshoot", () => {
    const nodes: Node<FlowNodeData>[] = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          label: "脚本",
          scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
          storyboardShots: [
            {
              scriptBeatId: "b1",
              status: "generated",
              visualPrompt: "x",
              videoStatus: "failed",
            },
          ],
        },
      },
    ];
    const situation = buildHermesSituation(nodes, [], "/proj");
    expect(pickKnowledgeScenesFromSituation(situation)).toContain("troubleshoot");
    expect(buildKnowledgeQueryFromSituation(situation)).toMatch(/视频|失败/);
  });
});
