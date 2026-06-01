import { describe, expect, it } from "vitest";
import { buildHermesCanvasContext } from "@/lib/hermes/hermesCanvasContext";
import {
  decideLoopRecoverySteps,
  preflightInjectedSteps,
  type AgentLoopObserve,
} from "@/lib/hermes/agent/hermesAgentLoop";
import type { HermesPlanStep } from "@/lib/hermes/hermesDirectorTypes";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";

function scriptNode(id: string, data: Partial<FlowNodeData> = {}): Node<FlowNodeData> {
  return {
    id,
    type: "scriptNode",
    position: { x: 0, y: 0 },
    data: { label: "脚本", ...data },
  };
}

function observeFromNodes(
  nodes: Node<FlowNodeData>[],
  production: Partial<AgentLoopObserve["production"]>,
): AgentLoopObserve {
  const canvas = buildHermesCanvasContext(nodes, "/proj");
  return {
    canvas,
    production: {
      beatCount: 2,
      storyboardReady: 0,
      storyboardMissing: 2,
      storyboardFailed: 0,
      imageReady: 0,
      imageMissing: 0,
      videoGenerated: 0,
      videoFailed: 0,
      videoEligible: 0,
      videoMissing: 0,
      exportReady: 0,
      exportTotal: 0,
      ...production,
    },
    nodes,
    edges: [],
    bible: null,
  };
}

const videoStep: HermesPlanStep = {
  id: "v1",
  toolId: "video.generate_for_beats",
  label: "批量出视频",
};

describe("preflightInjectedSteps", () => {
  it("出视频前缺图时插入 image.generate_for_beats", () => {
    const nodes = [
      scriptNode("s1", {
        scriptBeats: [
          { id: "b1", shotNumber: "1", description: "a" },
        ] as FlowNodeData["scriptBeats"],
        storyboardShots: [
          { scriptBeatId: "b1", status: "generated", visualPrompt: "x" },
        ],
      }),
    ];
    const observe = observeFromNodes(nodes, {
      beatCount: 1,
      storyboardReady: 1,
      storyboardMissing: 0,
      imageReady: 0,
      imageMissing: 1,
    });
    const injected = preflightInjectedSteps(videoStep, observe);
    expect(injected.some((s) => s.toolId === "image.generate_for_beats")).toBe(true);
  });

  it("出图前缺分镜时插入 generate_storyboard", () => {
    const nodes = [
      scriptNode("s1", {
        prompt: "梗概",
        scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
      }),
    ];
    const observe = observeFromNodes(nodes, {
      beatCount: 1,
      storyboardReady: 0,
      storyboardMissing: 1,
    });
    const step: HermesPlanStep = {
      id: "i1",
      toolId: "image.generate_for_beats",
      label: "出图",
    };
    const injected = preflightInjectedSteps(step, observe);
    expect(injected[0]?.toolId).toBe("script.generate_storyboard");
  });

  it("出视频前有失败镜时插入 video.retry_failed", () => {
    const nodes = [scriptNode("s1")];
    const observe = observeFromNodes(nodes, { videoFailed: 2 });
    const injected = preflightInjectedSteps(videoStep, observe);
    expect(injected.some((s) => s.toolId === "video.retry_failed")).toBe(true);
  });
});

describe("decideLoopRecoverySteps", () => {
  it("出图失败且缺分镜时优先补分镜", () => {
    const nodes = [
      scriptNode("s1", {
        scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
      }),
    ];
    const observe = observeFromNodes(nodes, {
      beatCount: 1,
      storyboardReady: 0,
      storyboardMissing: 1,
    });
    const failed: HermesPlanStep = {
      id: "f1",
      toolId: "image.generate_for_beats",
      label: "出图",
    };
    const steps = decideLoopRecoverySteps(
      failed,
      "timeout",
      { id: "p1", title: "t", sourceMessage: "出图", steps: [failed] },
      observe,
      0,
    );
    expect(steps?.[0]?.toolId).toBe("script.generate_storyboard");
  });

  it("出图失败且分镜就绪时重试出图", () => {
    const nodes = [
      scriptNode("s1", {
        scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
        storyboardShots: [
          { scriptBeatId: "b1", status: "generated", visualPrompt: "x" },
        ],
      }),
    ];
    const observe = observeFromNodes(nodes, {
      beatCount: 1,
      storyboardReady: 1,
      storyboardMissing: 0,
      imageMissing: 1,
    });
    const failed: HermesPlanStep = {
      id: "f1",
      toolId: "image.generate_for_beats",
      label: "出图",
    };
    const steps = decideLoopRecoverySteps(
      failed,
      "timeout",
      { id: "p1", title: "t", sourceMessage: "出图", steps: [failed] },
      observe,
      0,
    );
    expect(steps?.[0]?.toolId).toBe("image.generate_for_beats");
  });

  it("preflight injects storyboard retry when storyboard_failed", () => {
    const nodes = [
      scriptNode("s1", {
        scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
        storyboardShots: [{ scriptBeatId: "b1", status: "failed", visualPrompt: "" }],
      }),
    ];
    const observe = observeFromNodes(nodes, {
      beatCount: 1,
      storyboardReady: 0,
      storyboardFailed: 1,
    });
    const imageStep: HermesPlanStep = {
      id: "i1",
      toolId: "image.generate_for_beats",
      label: "出图",
    };
    const injected = preflightInjectedSteps(imageStep, observe);
    expect(injected.some((s) => s.toolId === "script.generate_storyboard")).toBe(true);
  });

  it("超过 replan 上限返回 null", () => {
    const observe = observeFromNodes([], {});
    const failed: HermesPlanStep = {
      id: "f1",
      toolId: "image.generate_for_beats",
      label: "出图",
    };
    expect(
      decideLoopRecoverySteps(
        failed,
        "err",
        { id: "p1", title: "t", sourceMessage: "x", steps: [] },
        observe,
        3,
      ),
    ).toBeNull();
  });
});
