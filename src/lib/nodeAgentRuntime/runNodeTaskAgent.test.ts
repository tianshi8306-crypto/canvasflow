import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runNodeTaskAgent } from "./runNodeTaskAgent";

const { mockFormatUserError } = vi.hoisted(() => ({
  // Match actual formatUserError behavior: extract message for Error objects
  mockFormatUserError: vi.fn((e: unknown) => {
    if (e instanceof Error && e.message.trim()) return e.message;
    if (typeof e === "string" && e.trim()) return e;
    return String(e);
  }),
}));

vi.mock("@/lib/errors", () => ({
  formatUserError: mockFormatUserError,
}));

// ---------------------------------------------------------------------------
// Test helpers and stubs
// ---------------------------------------------------------------------------

function makeContext() {
  const phases: string[] = [];
  const updates: Array<{ id: string; patch: unknown }> = [];

  const ctx = {
    nodeId: "node-1",
    projectPath: "d:/test-project",
    updateNodeData: vi.fn((id: string, patch: unknown) => {
      updates.push({ id, patch });
    }),
    setStatusText: vi.fn(),
    reportAgentEvent: vi.fn(),
  };

  return { ctx, phases, updates };
}

function makeRuntime(name: string) {
  return {
    agentName: name,
    sense: vi.fn().mockResolvedValue("sensed-result"),
    execute: vi.fn().mockResolvedValue("executed-result"),
    validate: vi.fn().mockResolvedValue("committed-result" as unknown as string),
    commit: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runNodeTaskAgent lifecycle", () => {
  let dispatchEventSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dispatchEventSpy = vi.fn();
    vi.stubGlobal("window", { dispatchEvent: dispatchEventSpy });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function getEmittedPhases() {
    return dispatchEventSpy.mock.calls
      .map(([e]) => (e as CustomEvent).detail?.phase as string)
      .filter(Boolean);
  }

  it("emits start → sense → execute → validate → commit → end in correct order", async () => {
    const { ctx } = makeContext();
    const runtime = makeRuntime("TestAgent");
    await runNodeTaskAgent(runtime, "input" as unknown, ctx);
    expect(getEmittedPhases()).toEqual(["start", "sense", "execute", "validate", "commit", "end"]);
  });

  it("does not emit 'error' phase on success", async () => {
    const { ctx } = makeContext();
    const runtime = makeRuntime("TestAgent");
    await runNodeTaskAgent(runtime, "input" as unknown, ctx);
    expect(getEmittedPhases()).not.toContain("error");
  });

  it("calls reportAgentEvent with correct phase sequence on success", async () => {
    const { ctx } = makeContext();
    const runtime = makeRuntime("TestAgent");
    await runNodeTaskAgent(runtime, "input" as unknown, ctx);
    const reportedPhases = ctx.reportAgentEvent.mock.calls.map(
      (c: unknown[]) => (c[0] as { phase: string }).phase,
    );
    expect(reportedPhases).toEqual(["start", "sense", "execute", "validate", "commit", "end"]);
  });

  it("reports nodeId and projectPath in every event", async () => {
    const { ctx } = makeContext();
    const runtime = makeRuntime("MyAgent");
    await runNodeTaskAgent(runtime, "input" as unknown, ctx);
    const events = dispatchEventSpy.mock.calls.map(([e]) => (e as CustomEvent).detail);
    for (const evt of events) {
      expect(evt.nodeId).toBe("node-1");
      expect(evt.projectPath).toBe("d:/test-project");
    }
  });

  it("commits with the result from validate", async () => {
    const { ctx } = makeContext();
    const commit = vi.fn();
    const runtime = {
      agentName: "TestAgent",
      sense: vi.fn().mockResolvedValue("sensed"),
      execute: vi.fn().mockResolvedValue("executed"),
      validate: vi.fn().mockResolvedValue("validated"),
      commit,
    };
    await runNodeTaskAgent(runtime, "input" as unknown, ctx);
    expect(commit).toHaveBeenCalledWith("validated", ctx);
  });

  it("returns the committed result", async () => {
    const { ctx } = makeContext();
    const runtime = {
      agentName: "TestAgent",
      sense: vi.fn().mockResolvedValue("s"),
      execute: vi.fn().mockResolvedValue("e"),
      validate: vi.fn().mockResolvedValue("v"),
      commit: vi.fn(),
    };
    const result = await runNodeTaskAgent(runtime, "input" as unknown, ctx);
    expect(result).toBe("v");
  });

  describe("error path", () => {
    it("emits 'error' phase instead of 'end' when sense throws", async () => {
      const { ctx } = makeContext();
      const runtime = {
        agentName: "TestAgent",
        sense: vi.fn().mockRejectedValue(new Error("sense failed")),
        execute: vi.fn(),
        validate: vi.fn(),
        commit: vi.fn(),
      };
      await expect(runNodeTaskAgent(runtime, "input" as unknown, ctx)).rejects.toThrow("sense failed");
      expect(getEmittedPhases()).not.toContain("end");
      expect(getEmittedPhases()).toContain("error");
    });

    it("emits 'error' phase instead of 'end' when execute throws", async () => {
      const { ctx } = makeContext();
      const runtime = {
        agentName: "TestAgent",
        sense: vi.fn().mockResolvedValue("sensed"),
        execute: vi.fn().mockRejectedValue(new Error("execute failed")),
        validate: vi.fn(),
        commit: vi.fn(),
      };
      await expect(runNodeTaskAgent(runtime, "input" as unknown, ctx)).rejects.toThrow("execute failed");
      expect(getEmittedPhases()).not.toContain("end");
      expect(getEmittedPhases()).toContain("error");
    });

    it("emits 'error' phase instead of 'end' when validate throws", async () => {
      const { ctx } = makeContext();
      const runtime = {
        agentName: "TestAgent",
        sense: vi.fn().mockResolvedValue("sensed"),
        execute: vi.fn().mockResolvedValue("executed"),
        validate: vi.fn().mockRejectedValue(new Error("validate failed")),
        commit: vi.fn(),
      };
      await expect(runNodeTaskAgent(runtime, "input" as unknown, ctx)).rejects.toThrow("validate failed");
      expect(getEmittedPhases()).not.toContain("end");
      expect(getEmittedPhases()).toContain("error");
    });

    it("does NOT call commit when validate throws", async () => {
      const { ctx } = makeContext();
      const commit = vi.fn();
      const runtime = {
        agentName: "TestAgent",
        sense: vi.fn().mockResolvedValue("sensed"),
        execute: vi.fn().mockResolvedValue("executed"),
        validate: vi.fn().mockRejectedValue(new Error("bad validate")),
        commit,
      };
      await expect(runNodeTaskAgent(runtime, "input" as unknown, ctx)).rejects.toThrow();
      expect(commit).not.toHaveBeenCalled();
    });

    it("reports error message in the error event", async () => {
      const { ctx } = makeContext();
      const runtime = {
        agentName: "TestAgent",
        sense: vi.fn().mockRejectedValue(new Error("kaboom")),
        execute: vi.fn(),
        validate: vi.fn(),
        commit: vi.fn(),
      };
      await expect(runNodeTaskAgent(runtime, "input" as unknown, ctx)).rejects.toThrow();
      const errorCalls = dispatchEventSpy.mock.calls.filter(
        ([e]) => (e as CustomEvent).detail?.phase === "error",
      );
      expect(errorCalls).toHaveLength(1);
      expect((errorCalls[0][0] as CustomEvent).detail.error).toBe("kaboom");
    });

    it("calls setStatusText with error message on failure", async () => {
      const { ctx } = makeContext();
      const runtime = {
        agentName: "BoomAgent",
        sense: vi.fn().mockRejectedValue(new Error("boom")),
        execute: vi.fn(),
        validate: vi.fn(),
        commit: vi.fn(),
      };
      await expect(runNodeTaskAgent(runtime, "input" as unknown, ctx)).rejects.toThrow();
      expect(ctx.setStatusText).toHaveBeenCalledWith(expect.stringContaining("BoomAgent"));
    });

    it("rethrows the original error after emitting error event", async () => {
      const { ctx } = makeContext();
      const runtime = {
        agentName: "TestAgent",
        sense: vi.fn().mockRejectedValue(new Error("original")),
        execute: vi.fn(),
        validate: vi.fn(),
        commit: vi.fn(),
      };
      await expect(runNodeTaskAgent(runtime, "input" as unknown, ctx)).rejects.toThrow("original");
    });
  });
});