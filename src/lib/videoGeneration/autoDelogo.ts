/**
 * autoDelogo.ts
 *
 * 视频生成后自动去字幕桥接层。
 * 无需用户手动框选，自动对视频底部字幕条区域执行 FFmpeg delogo。
 *
 * Seedance / 即梦等 AI 视频平台常在底部 8-12% 区域叠加硬字幕；
 * 本函数调用 Rust 端 auto_delogo_video_to_assets 命令完成清理。
 */

import { invoke, isTauri } from "@tauri-apps/api/core";
import type { ImportedMediaItem } from "@/shared/api/assets";

/**
 * 对已生成的视频执行自动去字幕（无需用户框选区域）
 *
 * @param projectPath 工程根目录的绝对路径
 * @param videoRelPath 视频在工程内的相对路径
 * @returns 清理后的视频素材信息
 */
export async function autoDelogoVideo(
  projectPath: string,
  videoRelPath: string,
): Promise<ImportedMediaItem> {
  if (!isTauri()) {
    throw new Error("自动去字幕仅支持桌面端");
  }

  return invoke<ImportedMediaItem>("auto_delogo_video_to_assets", {
    projectPath,
    videoRelPath,
    sourceWidth: null,
    sourceHeight: null,
    margin: null,
    band: null,
  });
}
