export type RunStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface RunSummary {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  error: string | null;
}

/** 与 `runs.db` 中 `run_events` 行一致（camelCase 由后端 serde 输出） */
export interface RunEventRow {
  id: number;
  runId: string;
  ts: string;
  nodeId: string | null;
  kind: string;
  payloadJson: string;
}
