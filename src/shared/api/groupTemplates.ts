import { invoke } from "@tauri-apps/api/core";
import type { CanvasGroupTemplateListItem } from "@/lib/canvasGroupTemplate";

export type GroupTemplateSummaryDto = {
  id: string;
  name: string;
  rel_path: string;
  created_at: number;
};

export async function listProjectGroupTemplates(
  projectPath: string,
): Promise<CanvasGroupTemplateListItem[]> {
  const rows = await invoke<GroupTemplateSummaryDto[]>("list_group_template_summaries", {
    projectPath,
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    relPath: r.rel_path,
  }));
}

export async function writeProjectGroupTemplate(
  projectPath: string,
  relPath: string,
  content: string,
): Promise<void> {
  await invoke("write_project_rel_text_file", { projectPath, relPath, content });
}

export async function readProjectGroupTemplate(
  projectPath: string,
  relPath: string,
): Promise<string> {
  return invoke<string>("read_project_rel_text_file", { projectPath, relPath });
}
