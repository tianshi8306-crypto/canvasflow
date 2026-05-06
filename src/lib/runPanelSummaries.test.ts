import { describe, expect, it } from "vitest";
import type { RunEventRow } from "@/entities";
import { summarizeAgentPhases, summarizeRunEvents } from "@/lib/runPanelSummaries";

function runEvent(
  kind: string,
  payload: unknown,
  nodeId: string | null,
  ts = "2026-01-01T00:00:00.000Z",
): RunEventRow {
  return {
    id: Math.floor(Math.random() * 100000),
    runId: "r1",
    ts,
    nodeId,
    kind,
    payloadJson: JSON.stringify(payload),
  };
}

describe("runPanelSummaries", () => {
  it("summarizeRunEvents aggregates node states and skipped reasons", () => {
    const events: RunEventRow[] = [
      runEvent("node_state", { state: "succeeded" }, "n1"),
      runEvent("node_state", { state: "failed" }, "n2"),
      runEvent("node_state", { state: "skipped", reason: "no_input" }, "n3"),
      runEvent("node_state", { state: "running" }, "n4"),
      runEvent("node_state", { state: "skipped", reason: "no_input" }, "n5"),
    ];
    const s = summarizeRunEvents(events);
    expect(s.total).toBe(5);
    expect(s.failed).toBe(1);
    expect(s.skipped).toBe(2);
    expect(s.running).toBe(1);
    expect(s.failedNodeIds).toContain("n2");
    expect(s.skippedReasonCount.no_input).toBe(2);
  });

  it("summarizeAgentPhases returns latest phase per node and stalled set", () => {
    const events: RunEventRow[] = [
      runEvent("agent_phase", { phase: "start", agentName: "A", elapsedMs: 1 }, "n1", "2026-01-01T00:00:00.000Z"),
      runEvent("agent_phase", { phase: "execute", agentName: "A", elapsedMs: 20 }, "n1", "2026-01-01T00:00:01.000Z"),
      runEvent("agent_phase", { phase: "end", agentName: "A", elapsedMs: 40 }, "n1", "2026-01-01T00:00:02.000Z"),
      runEvent("agent_phase", { phase: "validate", agentName: "B", elapsedMs: 10 }, "n2", "2026-01-01T00:00:01.500Z"),
    ];
    const s = summarizeAgentPhases(events);
    expect(s).not.toBeNull();
    expect(s!.totalEvents).toBe(4);
    expect(s!.errorEvents).toBe(0);
    expect(s!.nodePhases.find((x) => x.nodeId === "n1")?.latestPhase).toBe("end");
    expect(s!.stalled.map((x) => x.nodeId)).toContain("n2");
  });
});

