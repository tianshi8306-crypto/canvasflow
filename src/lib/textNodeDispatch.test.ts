import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchTextNodeComposerRun } from "./textNodeDispatch";

const { mockRunNodeTaskAgent } = vi.hoisted(() => ({
  mockRunNodeTaskAgent: vi.fn(),
}));

vi.mock("@/lib/nodeAgentRuntime/runNodeTaskAgent", () => ({
  runNodeTaskAgent: mockRunNodeTaskAgent,
}));

describe("dispatchTextNodeComposerRun", () => {
  const runNodeSubgraph = vi.fn(async () => {});
  const updateNodeData = vi.fn();
  const setStatusText = vi.fn();

  beforeEach(() => {
    runNodeSubgraph.mockReset();
    updateNodeData.mockReset();
    setStatusText.mockReset();
    mockRunNodeTaskAgent.mockReset();
  });

  it("shows hint and returns when projectPath is missing", async () => {
    await dispatchTextNodeComposerRun({
      nodeId: "n1",
      projectPath: null,
      prompt: "p",
      modelInput: "m",
      runNodeSubgraph,
      updateNodeData,
      setStatusText,
    });

    expect(setStatusText).toHaveBeenCalledWith("请先打开工程目录");
    expect(mockRunNodeTaskAgent).not.toHaveBeenCalled();
  });

  it("delegates to runNodeTaskAgent when projectPath exists", async () => {
    await dispatchTextNodeComposerRun({
      nodeId: "n1",
      projectPath: "d:/proj",
      prompt: "prompt",
      modelInput: "model",
      runNodeSubgraph,
      updateNodeData,
      setStatusText,
    });

    expect(mockRunNodeTaskAgent).toHaveBeenCalledTimes(1);
    const [, input, ctx] = mockRunNodeTaskAgent.mock.calls[0];
    expect(input).toEqual({
      prompt: "prompt",
      modelInput: "model",
      dispatch: runNodeSubgraph,
    });
    expect(ctx).toEqual({
      nodeId: "n1",
      projectPath: "d:/proj",
      updateNodeData,
      setStatusText,
    });
  });
});
