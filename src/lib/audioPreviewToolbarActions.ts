import { invoke, isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

/** Tauri：系统另存为，将工程内音频复制到用户选择路径 */
export async function downloadProjectAudioWithDialog(
  projectPath: string,
  relPath: string,
  defaultName: string,
): Promise<boolean> {
  if (!isTauri()) return false;

  const dest = await save({
    title: "下载音频",
    defaultPath: defaultName,
    filters: [
      { name: "音频", extensions: ["mp3", "wav", "m4a", "flac", "ogg", "aac"] },
      { name: "所有文件", extensions: ["*"] },
    ],
  });

  if (!dest) return false;

  await invoke("copy_project_file", {
    projectPath,
    relPath,
    destPath: dest,
  });

  return true;
}
