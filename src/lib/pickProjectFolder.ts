import { invoke, isTauri } from "@tauri-apps/api/core";
import { readDefaultBrowseDirectory } from "@/lib/recentProjects";

/** 桌面端：选择工程目录，默认定位到上次浏览/当前工程所在文件夹 */
export async function pickProjectFolder(currentProjectPath?: string | null): Promise<string | null> {
  if (!isTauri()) return null;
  const defaultDirectory = readDefaultBrowseDirectory(currentProjectPath) ?? null;
  const folder = await invoke<string | null>("pick_project_folder", { defaultDirectory });
  return folder?.trim() ? folder.trim() : null;
}
