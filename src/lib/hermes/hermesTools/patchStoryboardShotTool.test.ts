import { describe, expect, it } from "vitest";
import { extractVisualPatchFromMessage } from "@/lib/hermes/hermesTools/patchStoryboardShotTool";
import { buildDirectorPlan } from "@/lib/hermes/hermesPlanFromIntent";
import { buildHermesCanvasContext } from "@/lib/hermes/hermesCanvasContext";
import { setCachedHermesWorkstateForTest } from "@/lib/hermes/agent/hermesWorkstate";
import { useProjectStore } from "@/store/projectStore";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";

describe("extractVisualPatchFromMessage", () => {
  it("extracts text after 改成", () => {
    expect(extractVisualPatchFromMessage("把第 2 镜改成夜景街道再出图")).toBe("夜景街道");
  });

  it("returns undefined when no patch phrase", () => {
    expect(extractVisualPatchFromMessage("帮第 2 镜出图")).toBeUndefined();
  });
});

describe("buildDirectorPlan patch_shot", () => {
  const nodes: Node<FlowNodeData>[] = [
    {
      id: "s1",
      type: "scriptNode",
      position: { x: 0, y: 0 },
      data: {
        label: "脚本",
        scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
        storyboardShots: [
          { scriptBeatId: "b1", status: "generated", visualPrompt: "白天" },
        ],
      },
    },
  ];

  it("plans patch_shot for 改镜再出图", () => {
    const ctx = buildHermesCanvasContext(nodes, "/proj");
    const plan = buildDirectorPlan("把第 1 镜改成雨夜霓虹再出图", ctx);
    expect(plan?.steps[0]?.toolId).toBe("storyboard.patch_shot");
    expect(plan?.steps[0]?.args?.regenerateImage).toBe(true);
    expect(plan?.steps[0]?.args?.visualPrompt).toBe("雨夜霓虹");
  });

  it("plans patch_shot for 重出图", () => {
    const ctx = buildHermesCanvasContext(nodes, "/proj");
    const plan = buildDirectorPlan("第 1 镜重出图", ctx);
    expect(plan?.steps.some((s) => s.toolId === "storyboard.patch_shot")).toBe(true);
  });

  it("plans style clone with styleReferenceShot", () => {
    setCachedHermesWorkstateForTest({
      version: 1,
      activeJobs: [],
      updatedAt: new Date().toISOString(),
      lastStyleAnchor: {
        shotNumber: "1",
        visualPromptSnippet: "水墨国风远景",
        source: "storyboard_edit",
        at: new Date().toISOString(),
      },
    });
    const multi: Node<FlowNodeData>[] = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          label: "脚本",
          scriptBeats: [
            { id: "b1", shotNumber: "1", description: "a" },
            { id: "b2", shotNumber: "2", description: "b" },
          ] as FlowNodeData["scriptBeats"],
          storyboardShots: [
            { scriptBeatId: "b1", status: "generated", visualPrompt: "水墨国风远景" },
            { scriptBeatId: "b2", status: "generated", visualPrompt: "室内" },
          ],
        },
      },
    ];
    const ctx = buildHermesCanvasContext(multi, "/proj");
    const plan = buildDirectorPlan("第 2 镜按上面风格出图", ctx);
    expect(plan?.steps[0]?.toolId).toBe("storyboard.patch_shot");
    expect(plan?.steps[0]?.args?.beatIds).toEqual([2]);
    expect(plan?.steps[0]?.args?.styleReferenceShot).toBe(1);
    setCachedHermesWorkstateForTest(null);
  });

  it("plans version restore from cached snapshot", () => {
    const multi: Node<FlowNodeData>[] = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          scriptBeats: [
            { id: "b1", shotNumber: "1", description: "a", videoMotionPrompt: "慢推" },
            { id: "b2", shotNumber: "2", description: "b" },
          ] as FlowNodeData["scriptBeats"],
          storyboardShots: [
            { scriptBeatId: "b1", status: "generated", visualPrompt: "新画面" },
            { scriptBeatId: "b2", status: "generated", visualPrompt: "室内" },
          ],
        },
      },
    ];
    setCachedHermesWorkstateForTest({
      version: 1,
      activeJobs: [],
      updatedAt: new Date().toISOString(),
      lastVersionStyleReferent: {
        olderVersionId: "ver-old",
        at: new Date().toISOString(),
        snapshots: [
          { shotNumber: "1", visualPrompt: "雨夜霓虹", videoMotionPrompt: "慢推" },
          { shotNumber: "2", visualPrompt: "水墨远景" },
        ],
      },
    });
    const ctx = buildHermesCanvasContext(multi, "/proj");
    const plan = buildDirectorPlan("第 1 镜和上一版一样", ctx);
    expect(plan?.title).toBe("恢复上一版");
    expect(plan?.steps[0]?.toolId).toBe("storyboard.patch_shot");
    expect(plan?.steps[0]?.args?.visualPrompt).toBe("雨夜霓虹");
    expect(plan?.steps[0]?.args?.videoMotionPrompt).toBe("慢推");
    setCachedHermesWorkstateForTest(null);
  });

  it("plans motion clone with videoMotionPrompt", () => {
    setCachedHermesWorkstateForTest({
      version: 1,
      activeJobs: [],
      updatedAt: new Date().toISOString(),
      lastStyleAnchor: {
        shotNumber: "1",
        videoMotionSnippet: "慢推横移跟拍",
        source: "video_ready",
        at: new Date().toISOString(),
      },
    });
    const multi: Node<FlowNodeData>[] = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          scriptBeats: [
            { id: "b1", shotNumber: "1", description: "a" },
            { id: "b2", shotNumber: "2", description: "b" },
          ] as FlowNodeData["scriptBeats"],
          storyboardShots: [
            { scriptBeatId: "b1", status: "generated", visualPrompt: "夜景" },
            { scriptBeatId: "b2", status: "generated", visualPrompt: "室内" },
          ],
        },
      },
    ];
    const ctx = buildHermesCanvasContext(multi, "/proj");
    const plan = buildDirectorPlan("第 2 镜按上面运镜出视频", ctx);
    expect(plan?.title).toBe("运镜套用");
    expect(plan?.steps[0]?.toolId).toBe("storyboard.patch_shot");
    expect(plan?.steps[0]?.args?.videoMotionPrompt).toBe("慢推横移跟拍");
    expect(plan?.steps[0]?.args?.regenerateVideo).toBe(true);
    setCachedHermesWorkstateForTest(null);
  });

  it("plans batch style clone when no shot number", () => {
    const multi: Node<FlowNodeData>[] = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          scriptBeats: [
            { id: "b1", shotNumber: "1", description: "a" },
            { id: "b2", shotNumber: "2", description: "b" },
            { id: "b3", shotNumber: "3", description: "c" },
          ] as FlowNodeData["scriptBeats"],
          storyboardShots: [
            {
              scriptBeatId: "b1",
              status: "generated",
              visualPrompt: "水墨",
              imagePath: "assets/a.png",
            },
            { scriptBeatId: "b2", status: "generated", visualPrompt: "室内" },
            { scriptBeatId: "b3", status: "generated", visualPrompt: "街道" },
          ],
        },
      },
    ];
    useProjectStore.setState({ nodes: multi, edges: [], projectPath: "/proj" });
    setCachedHermesWorkstateForTest({
      version: 1,
      activeJobs: [],
      updatedAt: new Date().toISOString(),
      lastStyleAnchor: {
        shotNumber: "1",
        visualPromptSnippet: "水墨",
        source: "image_ready",
        at: new Date().toISOString(),
      },
    });
    const ctx = buildHermesCanvasContext(multi, "/proj");
    const plan = buildDirectorPlan("按上面风格出图", ctx);
    expect(plan?.title).toBe("批量风格套用");
    expect(plan?.steps[0]?.args?.beatIds).toEqual([2, 3]);
    setCachedHermesWorkstateForTest(null);
    useProjectStore.setState({ nodes: [], edges: [], projectPath: null });
  });
});
