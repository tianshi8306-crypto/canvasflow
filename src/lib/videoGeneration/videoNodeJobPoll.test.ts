import { describe, expect, it } from "vitest";
import { listVideoNodesWithActiveJobs } from "@/lib/videoGeneration/videoNodeJobPoll";

describe("listVideoNodesWithActiveJobs", () => {
  it("returns video nodes with queued or running jobs", () => {
    const ids = listVideoNodesWithActiveJobs([
      { id: "a", type: "imageNode", data: {} },
      {
        id: "v1",
        type: "videoNode",
        data: { video: { activeJob: { status: "queued" } } },
      },
      {
        id: "v2",
        type: "videoNode",
        data: { video: { activeJob: { status: "running" } } },
      },
      {
        id: "v3",
        type: "videoNode",
        data: { video: { activeJob: { status: "failed" } } },
      },
    ]);
    expect(ids).toEqual(["v1", "v2"]);
  });

  it("skips nodes that already have local video (not awaiting replacement)", () => {
    const ids = listVideoNodesWithActiveJobs([
      {
        id: "v1",
        type: "videoNode",
        data: {
          path: "assets/video/000001.mp4",
          video: { activeJob: { status: "queued" } },
        },
      },
      {
        id: "v2",
        type: "videoNode",
        data: {
          path: "assets/video/old.mp4",
          video: {
            awaitingNewResult: true,
            activeJob: { status: "running" },
          },
        },
      },
    ]);
    expect(ids).toEqual(["v2"]);
  });
});
