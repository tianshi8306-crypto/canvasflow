import { describe, expect, it } from "vitest";
import { buildHermesCanvasContext } from "@/lib/hermes/hermesCanvasContext";
import { buildDirectorPlan } from "@/lib/hermes/hermesPlanFromIntent";
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

describe("buildDirectorPlan", () => {
  it("添加文本节点计划含 canvas.add_text_node", () => {
    const ctx = buildHermesCanvasContext([], "/proj");
    const plan = buildDirectorPlan("不是咨询 你现在在画布上添加一个文本节点", ctx);
    expect(plan?.steps[0]?.toolId).toBe("canvas.add_text_node");
  });

  it("无脚本时「分镜出图」计划含 ensure_script", () => {
    const ctx = buildHermesCanvasContext([], "/proj");
    const plan = buildDirectorPlan("帮我把分镜出图", ctx);
    expect(plan).not.toBeNull();
    expect(plan!.steps.some((s) => s.toolId === "canvas.ensure_script")).toBe(true);
  });

  it("有脚本无镜头时创意话术含 generate_outline", () => {
    const nodes = [scriptNode("s1", { prompt: "雨夜女主" })];
    const ctx = buildHermesCanvasContext(nodes, "/proj");
    const plan = buildDirectorPlan("帮我写个 30 秒古风短片大纲", ctx);
    expect(plan?.steps.some((s) => s.toolId === "script.generate_outline")).toBe(true);
  });

  it("仅聊天问句不生成计划", () => {
    const ctx = buildHermesCanvasContext([], null);
    const plan = buildDirectorPlan("什么是分镜", ctx);
    expect(plan).toBeNull();
  });

  it("导出成片话术含 compose.export_script", () => {
    const nodes = [
      scriptNode("s1", {
        scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
      }),
    ];
    const ctx = buildHermesCanvasContext(nodes, "/proj");
    const plan = buildDirectorPlan("帮我把脚本导出成片", ctx);
    expect(plan?.steps.some((s) => s.toolId === "compose.export_script")).toBe(true);
    const exp = plan?.steps.find((s) => s.toolId === "compose.export_script");
    expect(exp?.args?.autoRender).toBe(true);
  });

  it("导出 prores 话术写入 exportFormat", () => {
    const nodes = [
      scriptNode("s1", {
        scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
      }),
    ];
    const ctx = buildHermesCanvasContext(nodes, "/proj");
    const plan = buildDirectorPlan("合成导出 ProRes 成片", ctx);
    const exp = plan?.steps.find((s) => s.toolId === "compose.export_script");
    expect(exp?.args?.exportFormat).toBe("prores");
  });

  it("导出 webm 话术写入 exportFormat", () => {
    const nodes = [
      scriptNode("s1", {
        scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
      }),
    ];
    const ctx = buildHermesCanvasContext(nodes, "/proj");
    const plan = buildDirectorPlan("合成并导出 webm 成片", ctx);
    const exp = plan?.steps.find((s) => s.toolId === "compose.export_script");
    expect(exp?.args?.exportFormat).toBe("webm");
  });

  it("重试失败视频含 video.retry_failed", () => {
    const nodes = [
      scriptNode("s1", {
        scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
        storyboardShots: [
          {
            scriptBeatId: "b1",
            status: "generated",
            visualPrompt: "x",
            videoStatus: "failed",
          },
        ],
      }),
    ];
    const ctx = buildHermesCanvasContext(nodes, "/proj");
    const plan = buildDirectorPlan("帮我把失败镜头的视频重新生成", ctx);
    expect(plan?.steps.some((s) => s.toolId === "video.retry_failed")).toBe(true);
  });

  it("重试失败关键帧含 image.retry_failed", () => {
    const nodes = [
      scriptNode("s1", {
        scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
        storyboardShots: [
          {
            scriptBeatId: "b1",
            status: "failed",
            visualPrompt: "scene",
          },
        ],
      }),
    ];
    const ctx = buildHermesCanvasContext(nodes, "/proj");
    const plan = buildDirectorPlan("帮我把失败镜头的关键帧重新出图", ctx);
    expect(plan?.steps.some((s) => s.toolId === "image.retry_failed")).toBe(true);
  });

  it("定位镜头含 canvas.focus", () => {
    const nodes = [
      scriptNode("s1", {
        scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
      }),
    ];
    const ctx = buildHermesCanvasContext(nodes, "/proj");
    const plan = buildDirectorPlan("帮我定位第 1 镜", ctx);
    expect(plan?.steps[0]?.toolId).toBe("canvas.focus");
  });

  it("跑模板展开 storyboard-keyframes", () => {
    const nodes = [
      scriptNode("s1", {
        scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
      }),
    ];
    const ctx = buildHermesCanvasContext(nodes, "/proj");
    const plan = buildDirectorPlan("跑模板 分镜出关键帧", ctx);
    expect(plan?.plannerSource).toBe("template");
    expect(plan?.steps.some((s) => s.toolId === "image.generate_for_beats")).toBe(true);
  });

  it("制片摘要含 canvas.summarize", () => {
    const ctx = buildHermesCanvasContext([], "/proj");
    const plan = buildDirectorPlan("帮我看看当前制片进度", ctx);
    expect(plan?.steps[0]?.toolId).toBe("canvas.summarize");
  });

  it("更新圣经含 bible.update", () => {
    const ctx = buildHermesCanvasContext([], "/proj");
    const plan = buildDirectorPlan("把视觉风格改成赛博朋克霓虹", ctx);
    expect(plan?.steps[0]?.toolId).toBe("bible.update");
  });

  it("改镜再出图含 storyboard.patch_shot", () => {
    const nodes = [
      scriptNode("s1", {
        scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
        storyboardShots: [{ scriptBeatId: "b1", status: "generated", visualPrompt: "x" }],
      }),
    ];
    const ctx = buildHermesCanvasContext(nodes, "/proj");
    const plan = buildDirectorPlan("第 1 镜改成雨夜再出图", ctx);
    expect(plan?.steps[0]?.toolId).toBe("storyboard.patch_shot");
  });

  it("出视频话术含 video.generate_for_beats", () => {
    const nodes = [
      scriptNode("s1", {
        scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
        storyboardShots: [
          { scriptBeatId: "b1", status: "generated", visualPrompt: "x" },
        ],
      }),
    ];
    const ctx = buildHermesCanvasContext(nodes, "/proj");
    const plan = buildDirectorPlan("帮第 1 镜出视频", ctx);
    expect(plan?.steps.some((s) => s.toolId === "video.generate_for_beats")).toBe(true);
  });

  it("全流程计划含出视频", () => {
    const ctx = buildHermesCanvasContext([], "/proj");
    const plan = buildDirectorPlan("帮我从头做全流程", ctx);
    expect(plan?.steps.some((s) => s.toolId === "video.generate_for_beats")).toBe(true);
  });

  it("仅准备时间线时 autoRender 为 false", () => {
    const nodes = [scriptNode("s1")];
    const ctx = buildHermesCanvasContext(nodes, "/proj");
    const plan = buildDirectorPlan("先准备合成时间线，不导出", ctx);
    const exp = plan?.steps.find((s) => s.toolId === "compose.export_script");
    expect(exp?.args?.autoRender).toBe(false);
  });

  it("解析第 2 镜出图时步骤带 beatIds", () => {
    const nodes = [
      scriptNode("s1", {
        scriptBeats: [
          { id: "b1", shotNumber: "1", description: "a" },
          { id: "b2", shotNumber: "2", description: "b" },
        ] as FlowNodeData["scriptBeats"],
        storyboardShots: [
          {
            scriptBeatId: "b1",
            status: "generated",
            visualPrompt: "x",
          },
          {
            scriptBeatId: "b2",
            status: "generated",
            visualPrompt: "y",
          },
        ],
      }),
    ];
    const ctx = buildHermesCanvasContext(nodes, "/proj");
    const plan = buildDirectorPlan("只出第 2 镜", ctx);
    const img = plan?.steps.find((s) => s.toolId === "image.generate_for_beats");
    expect(img?.args?.beatIds).toEqual([2]);
  });
});
