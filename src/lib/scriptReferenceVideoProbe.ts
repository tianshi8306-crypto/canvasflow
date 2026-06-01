import { invoke, isTauri } from "@tauri-apps/api/core";
import type { ScriptReferenceVideoMediaMeta } from "@/lib/scriptReferenceVideo";

/** 调用 ffprobe 读取工程内媒体元信息（供参考视频横幅展示） */
export async function probeScriptReferenceVideoMeta(
  projectPath: string,
  relPath: string,
): Promise<ScriptReferenceVideoMediaMeta | null> {
  if (!projectPath.trim() || !relPath.trim() || !isTauri()) return null;
  try {
    return await invoke<ScriptReferenceVideoMediaMeta>("probe_project_rel_media", {
      projectPath: projectPath.trim(),
      relPath: relPath.trim(),
    });
  } catch {
    return null;
  }
}
