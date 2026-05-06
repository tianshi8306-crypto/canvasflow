import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockInvoke, mockResolveMode, mockClient } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockResolveMode: vi.fn(),
  mockClient: {
    startJob: vi.fn(),
    getJob: vi.fn(),
    cancelJob: vi.fn(),
  },
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("./mode", () => ({
  resolveVideoGenerationMode: mockResolveMode,
}));

vi.mock("./apiPool", async () => {
  const actual = await vi.importActual<typeof import("./apiPool")>("./apiPool");
  return {
    ...actual,
    getVideoGenerationClient: () => mockClient,
  };
});

import { cancelVideoJobViaBridge, getVideoJobViaBridge, startVideoGenerationViaBridge } from "./bridge";

describe("videoGeneration bridge mode behavior", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockResolveMode.mockReset();
    mockClient.startJob.mockReset();
    mockClient.getJob.mockReset();
    mockClient.cancelJob.mockReset();
  });

  it("bridge mode throws when invoke fails", async () => {
    mockResolveMode.mockReturnValue("bridge");
    mockInvoke.mockRejectedValue(new Error("invoke failed"));
    await expect(
      startVideoGenerationViaBridge({
        projectPath: "d:/p",
        nodeId: "n1",
        payload: {
          workflow: "text_to_video",
          modelId: "doubao_seedance_2_0",
          prompt: "p",
          output: { aspectRatio: "16:9", durationSec: 5, resolution: "720P", generateAudio: true },
        },
      }),
    ).rejects.toThrow(/bridge 模式/);
    expect(mockClient.startJob).not.toHaveBeenCalled();
  });

  it("mock mode bypasses invoke and uses mock client", async () => {
    mockResolveMode.mockReturnValue("mock");
    mockClient.startJob.mockResolvedValue({ jobId: "mock_1" });
    const r = await startVideoGenerationViaBridge({
      projectPath: "d:/p",
      nodeId: "n1",
      payload: {
        workflow: "text_to_video",
        modelId: "doubao_seedance_2_0",
        prompt: "p",
        output: { aspectRatio: "16:9", durationSec: 5, resolution: "720P", generateAudio: true },
      },
    });
    expect(r).toEqual({ jobId: "mock_1" });
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockClient.startJob).toHaveBeenCalledTimes(1);
  });

  it("auto mode falls back to mock when invoke fails", async () => {
    mockResolveMode.mockReturnValue("auto");
    mockInvoke.mockRejectedValue(new Error("invoke failed"));
    mockClient.getJob.mockResolvedValue({
      id: "j1",
      status: "running",
      modelId: "doubao_seedance_2_0",
      source: "mock",
    });
    const r = await getVideoJobViaBridge("j1");
    expect(r.source).toBe("mock");
    expect(mockClient.getJob).toHaveBeenCalledWith("j1");
  });

  it("bridge mode cancel throws and does not fallback", async () => {
    mockResolveMode.mockReturnValue("bridge");
    mockInvoke.mockRejectedValue(new Error("cancel failed"));
    await expect(cancelVideoJobViaBridge("j1")).rejects.toThrow(/bridge 模式/);
    expect(mockClient.cancelJob).not.toHaveBeenCalled();
  });
});
