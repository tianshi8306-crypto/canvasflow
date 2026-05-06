import { invoke } from "@tauri-apps/api/core";
import type { RunEventRow, RunSummary } from "@/entities";

export async function fetchRuns(projectPath: string, limit = 20): Promise<RunSummary[]> {
  return invoke<RunSummary[]>("list_runs", { projectPath, limit });
}

export async function fetchRunEvents(projectPath: string, runId: string): Promise<RunEventRow[]> {
  return invoke<RunEventRow[]>("list_run_events", { projectPath, runId });
}
