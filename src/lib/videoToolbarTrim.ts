import { invoke, isTauri } from "@tauri-apps/api/core";
import type { ImportedMediaItem } from "@/shared/api/assets";
import type { VideoSourceTrim } from "@/lib/videoNodeTypes";

/** FFmpeg 裁剪工程内视频片段到 assets */
export async function trimVideoToAssets(
  projectPath: string,
  videoRelPath: string,
  trim: VideoSourceTrim,
): Promise<ImportedMediaItem> {
  if (!isTauri()) {
    throw new Error("请在桌面端使用视频裁剪");
  }
  return invoke<ImportedMediaItem>("trim_video_to_assets", {
    projectPath,
    videoRelPath,
    inSec: trim.inSec,
    outSec: trim.outSec,
  });
}
