import { beforeEach, describe, expect, it } from "vitest";
import { getVideoGenerationClient, resetVideoGenerationClientToMock } from "./apiPool";

describe("getVideoGenerationClient (mock client)", () => {
  beforeEach(() => {
    resetVideoGenerationClientToMock();
  });

  it("startJob returns a jobId with mock_ prefix", async () => {
    const client = getVideoGenerationClient();
    const result = await client.startJob({
      projectPath: "d:/test-project",
      nodeId: "node-1",
      payload: {
        workflow: "text_to_video",
        modelId: "doubao_seedance_2_0",
        prompt: "a cat playing piano",
        output: { aspectRatio: "16:9", durationSec: 5, resolution: "720P", generateAudio: true },
      },
    });
    expect(result.jobId).toMatch(/^mock_/);
  });

  it("getJob returns queued on first poll", async () => {
    const client = getVideoGenerationClient();
    const { jobId } = await client.startJob({
      projectPath: "d:/test-project",
      nodeId: "node-1",
      payload: {
        workflow: "text_to_video",
        modelId: "doubao_seedance_2_0",
        prompt: "test",
        output: { aspectRatio: "16:9", durationSec: 5, resolution: "720P", generateAudio: true },
      },
    });
    const snap = await client.getJob(jobId);
    expect(snap.status).toBe("queued");
    expect(snap.source).toBe("mock");
  });

  it("getJob returns running on second poll", async () => {
    const client = getVideoGenerationClient();
    const { jobId } = await client.startJob({
      projectPath: "d:/test-project",
      nodeId: "node-1",
      payload: {
        workflow: "text_to_video",
        modelId: "doubao_seedance_2_0",
        prompt: "test",
        output: { aspectRatio: "16:9", durationSec: 5, resolution: "720P", generateAudio: true },
      },
    });
    await client.getJob(jobId); // poll 1 -> queued
    const snap = await client.getJob(jobId); // poll 2 -> running
    expect(snap.status).toBe("running");
  });

  it("getJob returns succeeded after 4 polls with resultRelPath=null", async () => {
    const client = getVideoGenerationClient();
    const { jobId } = await client.startJob({
      projectPath: "d:/test-project",
      nodeId: "node-1",
      payload: {
        workflow: "text_to_video",
        modelId: "doubao_seedance_2_0",
        prompt: "test",
        output: { aspectRatio: "16:9", durationSec: 5, resolution: "720P", generateAudio: true },
      },
    });
    await client.getJob(jobId); // 1
    await client.getJob(jobId); // 2
    await client.getJob(jobId); // 3
    const snap = await client.getJob(jobId); // 4 -> succeeded
    expect(snap.status).toBe("succeeded");
    expect(snap.progress).toBe(1);
    expect(snap.source).toBe("mock");
    expect(snap.resultRelPath).toBeNull();
  });

  it("getJob returns failed for unknown jobId", async () => {
    const client = getVideoGenerationClient();
    const snap = await client.getJob("unknown-job-id");
    expect(snap.status).toBe("failed");
    expect(snap.error).toBe("任务不存在（可能已过期）");
    expect(snap.source).toBe("mock");
  });

  it("cancelJob removes the job", async () => {
    const client = getVideoGenerationClient();
    const { jobId } = await client.startJob({
      projectPath: "d:/test-project",
      nodeId: "node-1",
      payload: {
        workflow: "text_to_video",
        modelId: "doubao_seedance_2_0",
        prompt: "test",
        output: { aspectRatio: "16:9", durationSec: 5, resolution: "720P", generateAudio: true },
      },
    });
    await client.cancelJob(jobId);
    const snap = await client.getJob(jobId);
    expect(snap.status).toBe("failed");
  });

  it("multiple jobs are independent", async () => {
    const client = getVideoGenerationClient();
    const r1 = await client.startJob({
      projectPath: "d:/p",
      nodeId: "n1",
      payload: { workflow: "text_to_video", modelId: "doubao_seedance_2_0", prompt: "p", output: { aspectRatio: "16:9", durationSec: 5, resolution: "720P", generateAudio: true } },
    });
    const r2 = await client.startJob({
      projectPath: "d:/p",
      nodeId: "n2",
      payload: { workflow: "text_to_video", modelId: "doubao_seedance_2_0", prompt: "q", output: { aspectRatio: "16:9", durationSec: 5, resolution: "720P", generateAudio: true } },
    });
    expect(r1.jobId).not.toBe(r2.jobId);
    // First poll for each should be queued independently
    const s1 = await client.getJob(r1.jobId);
    const s2 = await client.getJob(r2.jobId);
    expect(s1.status).toBe("queued");
    expect(s2.status).toBe("queued");
  });

  it("listModels returns the catalog entries", async () => {
    const client = getVideoGenerationClient();
    const models = await client.listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toHaveProperty("id");
    expect(models[0]).toHaveProperty("label");
  });
});