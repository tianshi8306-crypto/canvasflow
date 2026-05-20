import { invoke, isTauri } from "@tauri-apps/api/core";
import type { ImportedMediaItem } from "@/shared/api/assets";
import type { VideoSubtitleRegion } from "@/lib/videoNodeTypes";

/** FFmpeg delogo：按归一化区域去除工程内视频字幕叠字 */
export async function delogoVideoToAssets(
  projectPath: string,
  videoRelPath: string,
  region: VideoSubtitleRegion,
  sourceWidth: number,
  sourceHeight: number,
): Promise<ImportedMediaItem> {
  if (!isTauri()) {
    throw new Error("请在桌面端使用框选去字幕");
  }
  return invoke<ImportedMediaItem>("delogo_video_to_assets", {
    projectPath,
    videoRelPath,
    regionX: region.x,
    regionY: region.y,
    regionW: region.w,
    regionH: region.h,
    sourceWidth: Math.round(sourceWidth),
    sourceHeight: Math.round(sourceHeight),
  });
}
