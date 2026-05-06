import { isTauri } from "@tauri-apps/api/core";
import { pickImagePathsForImport, pickVideoPathsForImport } from "@/lib/tauriMediaPaths";
import { importMediaFiles } from "@/shared/api/assets";
import { formatUserError } from "@/lib/errors";

type MediaKind = "image" | "video";

export async function importSingleProjectMedia(
  projectPath: string | null | undefined,
  kind: MediaKind,
  onStatusText?: (msg: string) => void,
): Promise<string | null> {
  const normalizedProjectPath = projectPath?.trim();
  if (!normalizedProjectPath) {
    onStatusText?.("请先打开工程后再导入素材");
    return null;
  }
  if (!isTauri()) {
    onStatusText?.("请在桌面端导入素材（浏览器预览环境不支持读取本地路径）");
    return null;
  }
  try {
    const paths =
      kind === "image" ? await pickImagePathsForImport(false) : await pickVideoPathsForImport(false);
    if (!paths?.length) return null;
    const imported = await importMediaFiles(normalizedProjectPath, paths);
    const item = imported[0];
    if (!item) return null;
    onStatusText?.(`已导入并填入：${item.relPath}`);
    return item.relPath;
  } catch (error) {
    onStatusText?.(`导入素材失败：${formatUserError(error)}`);
    return null;
  }
}
