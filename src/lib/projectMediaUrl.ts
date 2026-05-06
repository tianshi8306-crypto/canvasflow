import { convertFileSrc } from "@tauri-apps/api/core";
import { joinProjectRelativePath } from "@/lib/paths";

/**
 * 将工程内相对资源路径转为可供 img/video/audio 使用的 URL。
 * 依赖 Tauri `asset` 协议；非桌面环境可能返回 null。
 */
export function resolveProjectAssetSrc(
  projectRoot: string | null | undefined,
  relativePath: string | undefined,
): string | null {
  if (!projectRoot?.trim() || !relativePath?.trim()) return null;
  try {
    const abs = joinProjectRelativePath(projectRoot.trim(), relativePath.trim());
    return convertFileSrc(abs);
  } catch {
    return null;
  }
}
