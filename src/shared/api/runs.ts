import { invoke } from "@tauri-apps/api/core";
import type { RunEventRow, RunSummary } from "@/entities";

export async function fetchRuns(projectPath: string, limit = 20): Promise<RunSummary[]> {
  return invoke<RunSummary[]>("list_runs", { projectPath, limit });
}

export async function fetchRunEvents(projectPath: string, runId: string): Promise<RunEventRow[]> {
  return invoke<RunEventRow[]>("list_run_events", { projectPath, runId });
}

/** 将单个节点 Agent 事件写入 run_events（支持无 run_id 即席写入，自动创建临时 run） */
export async function appendNodeAgentEvent(params: {
  projectPath: string;
  nodeId: string;
  agentName: string;
  phase: string;
  elapsedMs: number;
  error?: string;
  runId?: string;
}): Promise<string> {
  return invoke<string>("append_node_agent_event", {
    projectPath: params.projectPath,
    nodeId: params.nodeId,
    agentName: params.agentName,
    phase: params.phase,
    elapsedMs: params.elapsedMs,
    error: params.error ?? null,
    runId: params.runId?.trim() ? params.runId.trim() : null,
  });
}
