import { describe, expect, it } from "vitest";
import { buildHermesSituation } from "@/lib/hermes/hermesSituation";
import {
  buildHermesProactiveSuggestions,
  expandProactiveDismissIds,
  filterSidebarProactiveChips,
  isProactiveSuggestionDismissed,
  pickHermesOrbSuggestion,
} from "@/lib/hermes/hermesProactiveSuggestions";
import type { HermesPipelineCheckpoint } from "@/lib/hermes/hermesPipelineCheckpoint";
import { productionFingerprint } from "@/lib/hermes/hermesOrbSuggestions.types";
import type { FlowNodeData } from "@/lib/types";
import type { Node } from "@xyflow/react";

describe("buildHermesProactiveSuggestions", () => {
  it("无脚本节点时不弹出创建脚本建议", () => {
    const situation = buildHermesSituation([], [], "/proj");
    const list = buildHermesProactiveSuggestions({
      situation,
      failedTaskCount: 0,
      nodes: [],
      edges: [],
    });
    expect(list.some((s) => s.id === "gap_no_script")).toBe(false);
    expect(list.some((s) => s.message.includes("脚本节点"))).toBe(false);
    expect(list.some((s) => s.id === "workflow_auto_repair")).toBe(false);
    expect(pickHermesOrbSuggestion({
      situation,
      failedTaskCount: 0,
      prevFingerprint: null,
      dismissedIds: new Set(),
    })).toBeNull();
  });

  it("仅出图工作流不催促批量出视频", () => {
    const nodes: Node<FlowNodeData>[] = [
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
            { scriptBeatId: "b1", status: "generated", visualPrompt: "雨夜", imagePath: "a.png" },
            { scriptBeatId: "b2", status: "generated", visualPrompt: "街道", imagePath: "b.png" },
          ],
        },
      },
    ];
    const situation = buildHermesSituation(nodes, [], "/proj");
    const list = buildHermesProactiveSuggestions({
      situation,
      failedTaskCount: 0,
      nodes,
      edges: [],
      prevFingerprint: productionFingerprint(situation.production),
    });
    expect(list.some((s) => s.message.includes("批量出视频"))).toBe(false);
    expect(list.some((s) => s.id === "video_eligible")).toBe(false);
    expect(list.some((s) => s.id === "optimize_video_prompts")).toBe(false);
    expect(list.some((s) => s.id === "gap_export_not_ready")).toBe(false);
  });

  it("includes storyboard_missing gap with prompt", () => {
    const nodes: Node<FlowNodeData>[] = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          label: "脚本",
          scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
        },
      },
    ];
    const situation = buildHermesSituation(nodes, [], "/proj");
    const list = buildHermesProactiveSuggestions({
      situation,
      failedTaskCount: 0,
    });
    const gap = list.find((s) => s.id === "gap_storyboard_missing");
    expect(gap?.actionPrompt).toContain("分镜");
    expect(gap?.actionLabel).toBe("生成分镜");
  });

  it("顾问向 E4 建议不进入主动弹窗列表", () => {
    const scriptNodes = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          label: "脚本",
          scriptBeats: [
            { id: "b1", shotNumber: "1", description: "a" },
            { id: "b2", shotNumber: "2", description: "b" },
            { id: "b3", shotNumber: "3", description: "c" },
            { id: "b4", shotNumber: "4", description: "d" },
          ] as FlowNodeData["scriptBeats"],
          storyboardShots: [
            { scriptBeatId: "b1", status: "generated", visualPrompt: "" },
            { scriptBeatId: "b2", status: "generated", visualPrompt: "" },
            { scriptBeatId: "b3", status: "generated", visualPrompt: "" },
            { scriptBeatId: "b4", status: "generated", visualPrompt: "有描述" },
          ],
        },
      },
    ] as import("@xyflow/react").Node<FlowNodeData>[];
    const situation = buildHermesSituation(scriptNodes, [], "/proj");
    const list = buildHermesProactiveSuggestions({
      situation,
      failedTaskCount: 0,
      nodes: scriptNodes,
    });
    expect(list.some((s) => s.id === "optimize_sparse_visuals")).toBe(false);
  });

  it("镜数顾问建议不进入主动弹窗列表", () => {
    const beats = Array.from({ length: 20 }, (_, i) => ({
      id: `b${i}`,
      shotNumber: String(i + 1),
      description: "scene",
    }));
    const nodes: Node<FlowNodeData>[] = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          label: "脚本",
          scriptBeats: beats as FlowNodeData["scriptBeats"],
          storyboardShots: beats.map((b) => ({
            scriptBeatId: b.id,
            status: "generated" as const,
            visualPrompt: "p",
          })),
        },
      },
    ];
    const situation = buildHermesSituation(nodes, [], "/proj");
    const list = buildHermesProactiveSuggestions({
      situation,
      failedTaskCount: 0,
    });
    expect(list.some((s) => s.id === "optimize_shot_count")).toBe(false);
  });

  it("filterSidebarProactiveChips hides gaps already in situation card", () => {
    const nodes: Node<FlowNodeData>[] = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          label: "脚本",
          scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
        },
      },
    ];
    const situation = buildHermesSituation(nodes, [], "/proj");
    const built = buildHermesProactiveSuggestions({
      situation,
      failedTaskCount: 0,
    });
    const filtered = filterSidebarProactiveChips(built, situation.gaps, true);
    expect(filtered.some((s) => s.id === "gap_storyboard_missing")).toBe(false);
    expect(built.some((s) => s.id === "gap_storyboard_missing")).toBe(true);
  });

  it("expandProactiveDismissIds links gap_ and bare ids", () => {
    expect(expandProactiveDismissIds("gap_storyboard_missing")).toContain(
      "storyboard_missing",
    );
    expect(isProactiveSuggestionDismissed("gap_storyboard_missing", new Set(["storyboard_missing"]))).toBe(
      true,
    );
  });

  it("includes pipeline_checkpoint_resume when checkpoint incomplete", () => {
    const nodes: Node<FlowNodeData>[] = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          label: "脚本",
          scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
          storyboardShots: [{ scriptBeatId: "b1", status: "generated", visualPrompt: "p" }],
        },
      },
    ];
    const situation = buildHermesSituation(nodes, [], "/proj");
    const cp: HermesPipelineCheckpoint = {
      projectPath: "/proj",
      completedStepCount: 0,
      savedAt: Date.now(),
      plan: {
        id: "p1",
        title: "测试计划",
        sourceMessage: "跑片",
        steps: [{ id: "s1", toolId: "canvas.summarize", label: "步1" }],
      },
    };
    const list = buildHermesProactiveSuggestions({
      situation,
      failedTaskCount: 0,
      pipelineCheckpoint: cp,
    });
    expect(list.some((s) => s.id === "pipeline_checkpoint_resume")).toBe(true);
  });

  it("pickHermesOrbSuggestion respects dismissed", () => {
    const nodes: Node<FlowNodeData>[] = [
      {
        id: "s1",
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          label: "脚本",
          scriptBeats: [{ id: "b1", shotNumber: "1", description: "a" }] as FlowNodeData["scriptBeats"],
          storyboardShots: [{ scriptBeatId: "b1", status: "failed", visualPrompt: "" }],
        },
      },
    ];
    const situation = buildHermesSituation(nodes, [], "/proj");
    const s = pickHermesOrbSuggestion({
      situation,
      failedTaskCount: 0,
      prevFingerprint: productionFingerprint(situation.production),
      dismissedIds: new Set([
        "storyboard_failed",
        "gap_storyboard_failed",
        "gap_storyboard_missing",
        "workflow_auto_repair",
        "optimize_sparse_visuals",
        "optimize_beat_pacing",
      ]),
    });
    expect(s).toBeNull();
  });
});
