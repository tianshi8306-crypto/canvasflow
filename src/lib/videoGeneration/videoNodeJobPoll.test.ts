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
});
