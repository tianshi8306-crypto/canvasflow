import { describe, expect, it } from "vitest";
import {
  mergeVisualWithStyleReference,
  messageHasMotionReferent,
  messageHasStyleReferent,
  mergeStyleAnchor,
  pickMotionCloneBatchShotNumbers,
  pickStyleCloneBatchShotNumbers,
  styleAnchorFromCanvasEvent,
  buildStyleAnchorFromScriptBeat,
  buildStyleAnchorFromVideoBeat,
  isStyleAnchorFresh,
} from "@/lib/hermes/agent/hermesStyleReferent";
import { useProjectStore } from "@/store/projectStore";
import { SCRIPT_BEAT_EMPTY_FIELDS } from "@/lib/scriptBeatHelpers";
import type { FlowNodeData, ScriptBeat } from "@/lib/types";
import type { Node } from "@xyflow/react";

function makeBeat(id: string, shotNumber: string, extra: Partial<ScriptBeat> = {}): ScriptBeat {
  return { ...SCRIPT_BEAT_EMPTY_FIELDS, id, shotNumber, ...extra };
}

describe("hermesStyleReferent", () => {
  it("messageHasStyleReferent", () => {
    expect(messageHasStyleReferent("第2镜按上面风格出图")).toBe(true);
    expect(messageHasStyleReferent("批量出图")).toBe(false);
  });

  it("messageHasMotionReferent", () => {
    expect(messageHasMotionReferent("第2镜按上面运镜出视频")).toBe(true);
    expect(messageHasMotionReferent("同样运镜")).toBe(true);
    expect(messageHasMotionReferent("按上面风格出图")).toBe(false);
  });

  it("isStyleAnchorFresh accepts motion-only anchor", () => {
    expect(
      isStyleAnchorFresh({
        videoMotionSnippet: "慢推横移",
        source: "video_ready",
        at: new Date().toISOString(),
      }),
    ).toBe(true);
  });

  it("styleAnchorFromCanvasEvent", () => {
    const a = styleAnchorFromCanvasEvent({
      id: "1",
      kind: "storyboard_edited",
      message: "x",
      shotNumber: "3",
      visualPromptSnippet: "赛博霓虹雨夜",
      at: new Date().toISOString(),
    });
    expect(a?.shotNumber).toBe("3");
    expect(a?.visualPromptSnippet).toContain("赛博");
  });

  it("mergeVisualWithStyleReference dedupes", () => {
    const merged = mergeVisualWithStyleReference(
      "赛博霓虹雨夜街道",
      "赛博霓虹雨夜街道，镜头推进",
    );
    expect(merged).toBe("赛博霓虹雨夜街道");
  });

  it("mergeVisualWithStyleReference appends", () => {
    const merged = mergeVisualWithStyleReference("室内对话", "水墨国风远景");
    expect(merged).toContain("水墨");
  });

  it("mergeStyleAnchor keeps newer", () => {
    const older = {
      visualPromptSnippet: "旧",
      source: "storyboard_edit" as const,
      at: "2020-01-01T00:00:00.000Z",
    };
    const newer = {
      visualPromptSnippet: "新",
      source: "storyboard_edit" as const,
      at: new Date().toISOString(),
    };
    expect(mergeStyleAnchor(older, newer)?.visualPromptSnippet).toBe("新");
  });

  it("buildStyleAnchorFromScriptBeat", () => {
    const node = {
      id: "s1",
      type: "scriptNode" as const,
      position: { x: 0, y: 0 },
      data: {
        scriptBeats: [makeBeat("b1", "2", { description: "desc" })],
        storyboardShots: [
          { scriptBeatId: "b1", status: "generated", visualPrompt: "霓虹雨夜" },
        ],
      },
    } as Node<FlowNodeData>;
    const a = buildStyleAnchorFromScriptBeat(node, "b1");
    expect(a?.source).toBe("image_ready");
    expect(a?.shotNumber).toBe("2");
    expect(a?.visualPromptSnippet).toContain("霓虹");
  });

  it("pickStyleCloneBatchShotNumbers prefers missing images", () => {
    const nodes: Node<FlowNodeData>[] = [
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
              visualPrompt: "ref",
              imagePath: "assets/a.png",
            },
            { scriptBeatId: "b2", status: "generated", visualPrompt: "x" },
            { scriptBeatId: "b3", status: "generated", visualPrompt: "y" },
          ],
        },
      },
    ];
    useProjectStore.setState({ nodes, edges: [], projectPath: "/proj" });
    const anchor = {
      shotNumber: "1",
      visualPromptSnippet: "ref",
      source: "image_ready" as const,
      at: new Date().toISOString(),
    };
    const nums = pickStyleCloneBatchShotNumbers(anchor, "按上面风格出图");
    expect(nums).toEqual([2, 3]);
  });

  it("pickMotionCloneBatchShotNumbers prefers missing videos", () => {
    const nodes: Node<FlowNodeData>[] = [
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
            { scriptBeatId: "b1", status: "generated", visualPrompt: "ref" },
            { scriptBeatId: "b2", status: "generated", visualPrompt: "x" },
            { scriptBeatId: "b3", status: "generated", visualPrompt: "y" },
          ],
        },
      },
      {
        id: "v1",
        type: "videoNode",
        position: { x: 0, y: 0 },
        data: { output: "assets/v1.mp4", params: { scriptBeatId: "b1" } },
      },
      {
        id: "v2",
        type: "videoNode",
        position: { x: 0, y: 0 },
        data: { params: { scriptBeatId: "b2" } },
      },
    ];
    useProjectStore.setState({
      nodes,
      edges: [
        { id: "e1", source: "s1", target: "v1" },
        { id: "e2", source: "s1", target: "v2" },
      ],
      projectPath: "/proj",
    });
    const anchor = {
      shotNumber: "1",
      videoMotionSnippet: "慢推",
      source: "video_ready" as const,
      at: new Date().toISOString(),
    };
    const nums = pickMotionCloneBatchShotNumbers(anchor, "按上面运镜出视频");
    expect(nums).toEqual([2, 3]);
  });

  it("buildStyleAnchorFromVideoBeat", () => {
    const node = {
      id: "s1",
      type: "scriptNode" as const,
      position: { x: 0, y: 0 },
      data: {
        scriptBeats: [makeBeat("b1", "2", { description: "desc", videoMotionPrompt: "横移跟拍" })],
        storyboardShots: [
          { scriptBeatId: "b1", status: "generated", visualPrompt: "霓虹雨夜" },
        ],
      },
    } as Node<FlowNodeData>;
    const a = buildStyleAnchorFromVideoBeat(node, "b1", "备用运镜");
    expect(a?.source).toBe("video_ready");
    expect(a?.videoMotionSnippet).toContain("横移");
  });
});
