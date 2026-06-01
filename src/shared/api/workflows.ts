import { invoke } from "@tauri-apps/api/core";
import type { CanvasWorkflowListItem } from "@/lib/canvasWorkflowSnapshot";

export type WorkflowSummaryDto = {
  id: string;
  name: string;
  rel_path: string;
  created_at: number;
  node_count: number;
  edge_count: number;
  kind: string;
};

export async function listProjectWorkflows(
  projectPath: string,
): Promise<CanvasWorkflowListItem[]> {
  const rows = await invoke<WorkflowSummaryDto[]>("list_workflow_summaries", {
    projectPath,
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    nodeCount: r.node_count,
    edgeCount: r.edge_count,
    kind: r.kind === "group" ? "group" : "selection",
    relPath: r.rel_path,
  }));
}

export async function writeProjectWorkflow(
  projectPath: string,
  relPath: string,
  content: string,
): Promise<void> {
  await invoke("write_project_rel_text_file", { projectPath, relPath, content });
}

export async function readProjectWorkflow(
  projectPath: string,
  relPath: string,
): Promise<string> {
  return invoke<string>("read_project_rel_text_file", { projectPath, relPath });
}

export async function deleteProjectWorkflowFile(
  projectPath: string,
  relPath: string,
): Promise<void> {
  await invoke("delete_project_rel_file", { projectPath, relPath });
}
