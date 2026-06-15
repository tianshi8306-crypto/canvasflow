import { describe, expect, it } from "vitest";
import {
  buildRestoredActiveJob,
  pickDiskJobForNode,
  shouldKeepInMemoryActiveJob,
  shouldSkipVideoJobReconcile,
  type PersistedVideoJobEntry,
} from "./reconcileVideoJobsLogic";

function entry(
  partial: Partial<PersistedVideoJobEntry> & Pick<PersistedVideoJobEntry, "jobId" | "nodeId">,
): PersistedVideoJobEntry {
  return {
    projectPath: "/proj",
    modelId: "doubao_seedance_2_0",
    polls: 0,
    cancelled: false,
    isDreamina: false,
    modifiedAtMs: 0,
    ...partial,
  };
}

describe("pickDiskJobForNode", () => {
  it("prefers in-progress job over older completed job with higher polls", () => {
    const entries = [
      entry({
        jobId: "old-done",
        nodeId: "v1",
        polls: 50,
        resultRelPath: "assets/video/000001.mp4",
        modifiedAtMs: 2000,
      }),
      entry({
        jobId: "new-run",
        nodeId: "v1",
        polls: 1,
        modifiedAtMs: 1000,
      }),
    ];
    expect(pickDiskJobForNode("v1", entries)?.jobId).toBe("new-run");
  });

  it("among completed jobs picks latest modified file", () => {
    const entries = [
      entry({
        jobId: "a",
        nodeId: "v1",
        polls: 10,
        resultRelPath: "assets/video/000001.mp4",
        modifiedAtMs: 100,
      }),
      entry({
        jobId: "b",
        nodeId: "v1",
        polls: 2,
        resultRelPath: "assets/video/000002.mp4",
        modifiedAtMs: 500,
      }),
    ];
    expect(pickDiskJobForNode("v1", entries)?.jobId).toBe("b");
  });
});

describe("shouldSkipVideoJobReconcile", () => {
  it("does not skip when same job has disk result but node path not updated", () => {
    const rel = "assets/video/000002.mp4";
    const disk = entry({ jobId: "j1", nodeId: "v1", resultRelPath: rel });
    const node = {
      id: "v1",
      data: {
        path: "assets/video/000001.mp4",
        video: { activeJob: { id: "j1", status: "queued" } },
      },
    };
    expect(shouldSkipVideoJobReconcile(node, disk)).toBe(false);
  });

  it("skips when already polling the same non-dreamina job", () => {
    const disk = entry({ jobId: "j1", nodeId: "v1", isDreamina: false });
    const node = {
      id: "v1",
      data: {
        video: { activeJob: { id: "j1", status: "running" } },
      },
    };
    expect(shouldSkipVideoJobReconcile(node, disk)).toBe(true);
  });

  it("does not skip stuck dreamina queued job without disk result", () => {
    const disk = entry({ jobId: "j1", nodeId: "v1", isDreamina: true });
    const node = {
      id: "v1",
      data: {
        video: { activeJob: { id: "j1", status: "queued" }, draft: {} as never },
      },
    };
    expect(shouldSkipVideoJobReconcile(node, disk)).toBe(false);
  });

  it("skips when node already has local video (no re-download)", () => {
    const disk = entry({ jobId: "j1", nodeId: "v1", isDreamina: true });
    const node = {
      id: "v1",
      data: {
        path: "assets/video/000001.mp4",
        video: {
          activeJob: { id: "j1", status: "queued" },
          draft: {} as never,
        },
      },
    };
    expect(shouldSkipVideoJobReconcile(node, disk)).toBe(true);
  });

  it("does not skip when node has old video but disk has new in-progress job", () => {
    const disk = entry({ jobId: "j-new", nodeId: "v1" });
    const node = {
      id: "v1",
      data: {
        path: "assets/video/000001.mp4",
        video: {},
      },
    };
    expect(shouldSkipVideoJobReconcile(node, disk)).toBe(false);
  });

  it("skips when node path already matches disk result", () => {
    const rel = "assets/video/000002.mp4";
    const disk = entry({ jobId: "j-done", nodeId: "v1", resultRelPath: rel });
    const node = {
      id: "v1",
      data: { path: rel, video: {} },
    };
    expect(shouldSkipVideoJobReconcile(node, disk)).toBe(true);
  });

  it("does not skip when disk has newer result than node path", () => {
    const disk = entry({
      jobId: "j-new",
      nodeId: "v1",
      resultRelPath: "assets/video/000002.mp4",
    });
    const node = {
      id: "v1",
      data: {
        path: "assets/video/000001.mp4",
        video: {},
      },
    };
    expect(shouldSkipVideoJobReconcile(node, disk)).toBe(false);
  });
});

describe("shouldKeepInMemoryActiveJob", () => {
  it("keeps memory-only running job when disk only has older completed task", () => {
    const entries = [
      entry({
        jobId: "old",
        nodeId: "v1",
        resultRelPath: "assets/video/000001.mp4",
        polls: 99,
      }),
    ];
    const disk = entries[0];
    const node = {
      id: "v1",
      data: {
        video: { activeJob: { id: "memory-only", status: "running" } },
      },
    };
    expect(shouldKeepInMemoryActiveJob(node, disk, entries)).toBe(true);
  });
});

describe("buildRestoredActiveJob", () => {
  it("uses running status when disk already has result path", () => {
    const job = buildRestoredActiveJob(
      entry({
        jobId: "j1",
        nodeId: "v1",
        resultRelPath: "assets/video/000003.mp4",
      }),
    );
    expect(job.status).toBe("running");
    expect(job.id).toBe("j1");
  });
});
