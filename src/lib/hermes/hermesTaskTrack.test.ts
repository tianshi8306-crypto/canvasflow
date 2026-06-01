import { describe, expect, it } from "vitest";
import {
  applyAgentEvent,
  applyBatchProgress,
  applyDirectorSteps,
  finishBatchStep,
  labelForAgentNode,
  patchDirectorStep,
  statusFromAgentPhase,
  taskIdForDirectorStep,
  taskIdForBatchStep,
} from "@/lib/hermes/hermesTaskTrack";
import type { NodeAgentRuntimeEvent } from "@/lib/nodeAgentRuntime/types";

function evt(partial: Partial<NodeAgentRuntimeEvent>): NodeAgentRuntimeEvent {
  return {
    agentName: "图片 Agent",
    nodeId: "n1",
    projectPath: "/p",
    phase: "execute",
    timestampMs: 1,
    elapsedMs: 0,
    ...partial,
  };
}

describe("hermesTaskTrack", () => {
  it("statusFromAgentPhase maps running and done", () => {
    expect(statusFromAgentPhase("execute")).toBe("running");
    expect(statusFromAgentPhase("end")).toBe("done");
    expect(statusFromAgentPhase("error")).toBe("failed");
  });

  it("applyAgentEvent upserts by nodeId", () => {
    let tasks = applyAgentEvent([], evt({ phase: "start" }), "镜1·图");
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.status).toBe("running");
    tasks = applyAgentEvent(tasks, evt({ phase: "end" }), "镜1·图");
    expect(tasks[0]!.status).toBe("done");
  });

  it("director steps patch status", () => {
    const steps = applyDirectorSteps([], [{ id: "s1", label: "出图" }]);
    expect(steps[0]!.id).toBe(taskIdForDirectorStep("s1"));
    const done = patchDirectorStep(steps, "s1", "done");
    expect(done.find((t) => t.id === taskIdForDirectorStep("s1"))?.status).toBe("done");
  });

  it("batch progress and finish", () => {
    let tasks = applyBatchProgress([], "step-1", {
      kind: "image",
      label: "批量出图",
      current: 1,
      total: 3,
      detail: "镜 2",
    });
    expect(tasks[0]!.id).toBe(taskIdForBatchStep("step-1"));
    expect(tasks[0]!.label).toContain("1/3");
    tasks = finishBatchStep(tasks, "step-1", true);
    expect(tasks.find((t) => t.id === taskIdForBatchStep("step-1"))?.status).toBe("done");
  });

  it("labelForAgentNode uses shot number", () => {
    const label = labelForAgentNode(
      { type: "imageNode", data: { params: { scriptBeatId: "b1" } } },
      [{ id: "b1", shotNumber: "3" }],
      "图片 Agent",
    );
    expect(label).toBe("镜 3·图");
  });
});
