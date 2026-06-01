import { describe, expect, it } from "vitest";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";
import {
  appendCanvasEvents,
  buildMediaFingerprint,
  buildScriptSnapshot,
  diffScriptSnapshots,
  formatCanvasEventsForPrompt,
  mediaStructureEvents,
} from "@/lib/hermes/agent/hermesCanvasEvents";

function scriptNode(data: Partial<FlowNodeData>): Node<FlowNodeData> {
  return {
    id: "s1",
    type: "scriptNode",
    position: { x: 0, y: 0 },
    data: { label: "脚本", ...data },
  };
}

describe("hermesCanvasEvents", () => {
  it("detects storyboard visualPrompt edit", () => {
    const prev = buildScriptSnapshot([
      scriptNode({
        scriptBeats: [{ id: "b1", shotNumber: "3", description: "a" }] as FlowNodeData["scriptBeats"],
        storyboardShots: [
          { scriptBeatId: "b1", status: "generated", visualPrompt: "旧" },
        ],
      }),
    ]);
    const next = buildScriptSnapshot([
      scriptNode({
        scriptBeats: [{ id: "b1", shotNumber: "3", description: "a" }] as FlowNodeData["scriptBeats"],
        storyboardShots: [
          { scriptBeatId: "b1", status: "generated", visualPrompt: "新夜景" },
        ],
      }),
    ]);
    const events = diffScriptSnapshots(prev, next!);
    expect(events.some((e) => e.kind === "storyboard_edited")).toBe(true);
    expect(events[0]!.message).toContain("镜 3");
  });

  it("formatCanvasEventsForPrompt lists recent lines", () => {
    const text = formatCanvasEventsForPrompt([
      {
        id: "1",
        kind: "selection_focused",
        message: "用户选中镜 2",
        at: new Date().toISOString(),
      },
    ]);
    expect(text).toContain("近期画布变化");
    expect(text).toContain("镜 2");
  });

  it("appendCanvasEvents dedupes by kind+message", () => {
    const a = {
      id: "1",
      kind: "storyboard_edited" as const,
      message: "镜 1：分镜已更新",
      beatId: "b1",
      at: new Date().toISOString(),
    };
    const merged = appendCanvasEvents([a], [a]);
    expect(merged).toHaveLength(1);
  });

  it("mediaStructureEvents on prompt change", () => {
    const image: Node<FlowNodeData> = {
      id: "i1",
      type: "imageNode",
      position: { x: 0, y: 0 },
      data: { label: "关键帧1", prompt: "新 prompt" },
    };
    const prev = buildMediaFingerprint([
      { ...image, data: { ...image.data, prompt: "旧" } },
    ]);
    const next = buildMediaFingerprint([image]);
    const events = mediaStructureEvents(prev, next, [image]);
    expect(events[0]!.kind).toBe("structure_changed");
    expect(events[0]!.message).toContain("关键帧1");
  });
});
