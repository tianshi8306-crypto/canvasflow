import type { RunEventRow } from "@/entities";

export type NodeState = "running" | "succeeded" | "failed" | "skipped";

export type AgentPhase =
  | "start"
  | "sense"
  | "execute"
  | "validate"
  | "commit"
  | "end"
  | "error";

export function summarizeRunEvents(events: RunEventRow[]) {
  const nodeStateById: Record<string, NodeState> = {};
  const skippedReasonCount: Record<string, number> = {};
  const failedNodeIds: string[] = [];
  for (const ev of events) {
    if (ev.kind !== "node_state" || !ev.nodeId) continue;
    let payload: { state?: string; reason?: string };
    try {
      payload = JSON.parse(ev.payloadJson || "{}") as { state?: string; reason?: string };
    } catch {
      continue;
    }
    const state = payload.state;
    if (state !== "running" && state !== "succeeded" && state !== "failed" && state !== "skipped") continue;
    nodeStateById[ev.nodeId] = state;
    if (state === "skipped") {
      const reason = payload.reason || "unknown";
      skippedReasonCount[reason] = (skippedReasonCount[reason] ?? 0) + 1;
    }
  }
  for (const [id, st] of Object.entries(nodeStateById)) {
    if (st === "failed") failedNodeIds.push(id);
  }
  const values = Object.values(nodeStateById);
  return {
    total: values.length,
    succeeded: values.filter((s) => s === "succeeded").length,
    failed: values.filter((s) => s === "failed").length,
    skipped: values.filter((s) => s === "skipped").length,
    running: values.filter((s) => s === "running").length,
    failedNodeIds,
    skippedReasonCount,
  };
}

export function summarizeAgentPhases(events: RunEventRow[]) {
  const byNode = new Map<
    string,
    {
      nodeId: string;
      latestPhase: AgentPhase;
      agentName: string;
      latestTs: string;
      elapsedMs: number;
      error?: string;
    }
  >();
  let total = 0;
  let errors = 0;
  for (const ev of events) {
    if (ev.kind !== "agent_phase") continue;
    let payload: {
      phase?: AgentPhase;
      agentName?: string;
      elapsedMs?: number;
      error?: string;
    };
    try {
      payload = JSON.parse(ev.payloadJson || "{}") as {
        phase?: AgentPhase;
        agentName?: string;
        elapsedMs?: number;
        error?: string;
      };
    } catch {
      continue;
    }
    const nodeId = ev.nodeId ?? "(unknown)";
    const phase = payload.phase;
    if (!phase) continue;
    total += 1;
    if (phase === "error") errors += 1;
    byNode.set(nodeId, {
      nodeId,
      latestPhase: phase,
      agentName: payload.agentName ?? "unknown-agent",
      latestTs: ev.ts,
      elapsedMs: Number.isFinite(payload.elapsedMs) ? Number(payload.elapsedMs) : 0,
      ...(payload.error ? { error: payload.error } : {}),
    });
  }
  if (total === 0) return null;
  const stalled = [...byNode.values()].filter((x) => x.latestPhase !== "end" && x.latestPhase !== "error");
  return {
    totalEvents: total,
    errorEvents: errors,
    nodePhases: [...byNode.values()].sort((a, b) => b.latestTs.localeCompare(a.latestTs)),
    stalled,
  };
}

