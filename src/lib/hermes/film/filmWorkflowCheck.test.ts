import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import {
  buildFilmWorkflowCheckReport,
  formatFilmWorkflowCheckMessage,
} from "@/lib/hermes/film/filmWorkflowCheck";
import type { FlowNodeData } from "@/lib/types";
import { normalizeScriptBeat } from "@/lib/scriptBeatHelpers";

describe("buildFilmWorkflowCheckReport", () => {
  it("flags missing project and script", () => {
    const report = buildFilmWorkflowCheckReport({
      nodes: [],
      edges: [],
      projectPath: null,
    });
    expect(report.stages.some((s) => s.id === "project" && s.status === "todo")).toBe(
      true,
    );
    expect(report.stages.some((s) => s.id === "script" && s.status === "todo")).toBe(
      true,
    );
    expect(report.blockers).toBeGreaterThan(0);
  });

  it("marks script with beats as partial when no storyboard", () => {
    const scriptId = "script-1";
    const nodes: Node<FlowNodeData>[] = [
      {
        id: scriptId,
        type: "scriptNode",
        position: { x: 0, y: 0 },
        data: {
          label: "脚本",
          scriptBeats: [
            normalizeScriptBeat({
              id: "b1",
              shotNumber: "1",
              scene: "",
              durationHint: "",
              description: "test",
            }),
          ],
        },
      },
    ];
    const report = buildFilmWorkflowCheckReport({
      nodes,
      edges: [],
      projectPath: "/tmp/proj",
    });
    const storyboard = report.stages.find((s) => s.id === "storyboard");
    expect(storyboard?.status).toBe("partial");
    const msg = formatFilmWorkflowCheckMessage(report);
    expect(msg).toContain("分镜");
  });
});
