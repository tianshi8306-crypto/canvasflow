/**
 * platformExportBridge.ts
 *
 * 平台导出桥接层：调用 Rust 端 platform_export_video 命令。
 */

import { invoke, isTauri } from "@tauri-apps/api/core";
import type { ImportedMediaItem } from "@/shared/api/assets";

export async function platformExportVideo(
  projectPath: string,
  videoRelPath: string,
  preset: string,
): Promise<ImportedMediaItem> {
  if (!isTauri()) {
    throw new Error("平台导出仅支持桌面端");
  }
  return invoke<ImportedMediaItem>("platform_export_video", {
    projectPath,
    videoRelPath,
    preset,
  });
}
