import { invoke, isTauri } from "@tauri-apps/api/core";
import type { ImportedMediaItem } from "@/shared/api/assets";

export type VideoAudioExtractMode = "vocal" | "bgm";

/** FFmpeg 从工程内视频提取音轨并写入 assets */
export async function extractVideoAudioToAssets(
  projectPath: string,
  videoRelPath: string,
  mode: VideoAudioExtractMode,
): Promise<ImportedMediaItem> {
  if (!isTauri()) {
    throw new Error("请在桌面端使用音频分离");
  }
  return invoke<ImportedMediaItem>("extract_video_audio_to_assets", {
    projectPath,
    videoRelPath,
    mode,
  });
}
