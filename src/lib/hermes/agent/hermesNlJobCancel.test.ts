import { beforeEach, describe, expect, it } from "vitest";
import type { HermesDirectorPlan } from "@/lib/hermes/hermesDirectorTypes";
import type { HermesJob } from "@/lib/hermes/agent/hermesJobStore";
import {
  resetHermesJobStoreForTest,
  useHermesJobStore,
} from "@/lib/hermes/agent/hermesJobStore";
import {
  clearPlanningMessageQueue,
  enqueuePlanningProductionMessage,
  loadPlanningMessageQueue,
} from "@/lib/hermes/agent/hermesPlanningMessageQueue";
import {
  directorJobMatchesCancelScope,
  executeHermesNlJobCancel,
  parseHermesNlJobCancelRequest,
  planningQueueItemMatchesCancelScope,
} from "@/lib/hermes/agent/hermesNlJobCancel";
import { SCRIPT_BEAT_EMPTY_FIELDS } from "@/lib/scriptBeatHelpers";
import type { FlowNodeData, ScriptBeat } from "@/lib/types";
import type { Node } from "@xyflow/react";

const PROJECT = "/proj/nl-cancel-test";
const SCRIPT_ID = "script-1";

function makeBeat(id: string, shotNumber: string): ScriptBeat {
  return { ...SCRIPT_BEAT_EMPTY_FIELDS, id, shotNumber };
}

function sampleNodes(): Node<FlowNodeData>[] {
  return [
    {
      id: SCRIPT_ID,
      type: "scriptNode",
      position: { x: 0, y: 0 },
      data: {
        scriptBeats: [makeBeat("b1", "1"), makeBeat("b2", "2"), makeBeat("b3", "3")],
      },
    },
  ];
}

function imagePlan(sourceMessage: string, beatIds: number[]): HermesDirectorPlan {
  return {
    id: "p1",
    title: sourceMessage,
    sourceMessage,
    steps: [
      {
        id: "s1",
        toolId: "image.generate_for_beats",
        label: `为第 ${beatIds.join("、")} 镜出图`,
        args: { beatIds },
      },
    ],
  };
}

function sampleJob(
  status: HermesJob["status"],
  plan: HermesDirectorPlan,
): HermesJob {
  return {
    id: `job-${plan.id}-${status}`,
    projectPath: PROJECT,
    kind: "director_plan",
    status,
    title: plan.title,
    createdAt: Date.now(),
    payload: { plan },
  };
}

describe("hermesNlJobCancel parse", () => {
  it("parses shot-specific image cancel", () => {
    expect(parseHermesNlJobCancelRequest("取消第 2 镜出图")).toEqual({
      kind: "both",
      scope: { mediaKind: "image", shotNumbers: [2] },
    });
  });

  it("parses cancel all video", () => {
    expect(parseHermesNlJobCancelRequest("只取消视频")).toEqual({
      kind: "both",
      scope: { mediaKind: "video", shotNumbers: [] },
    });
  });

  it("parses planning queue clear", () => {
    expect(parseHermesNlJobCancelRequest("取消规划队列")).toEqual({
      kind: "planning_queue",
      scope: "all",
    });
  });

  it("ignores consult mixed phrasing", () => {
    expect(parseHermesNlJobCancelRequest("别出图了，先聊聊")).toBeNull();
  });

  it("does not steal cancel all queued intent", () => {
    expect(parseHermesNlJobCancelRequest("取消全部排队")).toBeNull();
  });
});

describe("hermesNlJobCancel matching", () => {
  it("matches director job by beatIds in step args", () => {
    const job = sampleJob("queued", imagePlan("帮第 2 镜出图", [2]));
    expect(
      directorJobMatchesCancelScope(
        job,
        { mediaKind: "image", shotNumbers: [2] },
        SCRIPT_ID,
        sampleNodes(),
      ),
    ).toBe(true);
    expect(
      directorJobMatchesCancelScope(
        job,
        { mediaKind: "image", shotNumbers: [3] },
        SCRIPT_ID,
        sampleNodes(),
      ),
    ).toBe(false);
  });

  it("matches planning queue item by shot and media", () => {
    expect(
      planningQueueItemMatchesCancelScope("帮第 2 镜出图", {
        mediaKind: "image",
        shotNumbers: [2],
      }),
    ).toBe(true);
    expect(
      planningQueueItemMatchesCancelScope("帮第 2 镜出视频", {
        mediaKind: "image",
        shotNumbers: [2],
      }),
    ).toBe(false);
  });
});

describe("hermesNlJobCancel execute", () => {
  beforeEach(() => {
    resetHermesJobStoreForTest();
    clearPlanningMessageQueue(PROJECT);
  });

  it("cancels queued director job for shot", () => {
    const plan = imagePlan("第 2 镜出图", [2]);
    useHermesJobStore.getState().enqueueDirectorPlan(PROJECT, { plan });
    const result = executeHermesNlJobCancel(
      {
        kind: "both",
        scope: { mediaKind: "image", shotNumbers: [2] },
      },
      { projectPath: PROJECT, scriptNodeId: SCRIPT_ID, nodes: sampleNodes() },
    );
    expect(result.directorCancelled).toBe(1);
    expect(useHermesJobStore.getState().jobs[0]?.status).toBe("cancelled");
  });

  it("removes matching planning queue items", () => {
    enqueuePlanningProductionMessage(PROJECT, "帮第 2 镜出图");
    enqueuePlanningProductionMessage(PROJECT, "帮第 3 镜出图");
    const result = executeHermesNlJobCancel(
      {
        kind: "both",
        scope: { mediaKind: "image", shotNumbers: [2] },
      },
      { projectPath: PROJECT, scriptNodeId: SCRIPT_ID, nodes: sampleNodes() },
    );
    expect(result.planningRemoved).toBe(1);
    expect(loadPlanningMessageQueue(PROJECT)).toHaveLength(1);
    expect(loadPlanningMessageQueue(PROJECT)[0]?.text).toContain("第 3 镜");
  });

  it("clears entire planning queue", () => {
    enqueuePlanningProductionMessage(PROJECT, "任务 A");
    const result = executeHermesNlJobCancel(
      { kind: "planning_queue", scope: "all" },
      { projectPath: PROJECT, scriptNodeId: SCRIPT_ID, nodes: sampleNodes() },
    );
    expect(result.planningRemoved).toBe(1);
    expect(loadPlanningMessageQueue(PROJECT)).toHaveLength(0);
  });
});
