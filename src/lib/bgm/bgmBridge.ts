import { invoke } from "@tauri-apps/api/core";
import type { BgmAlignSettings } from "@/lib/bgm/audioAlign";

export type BgmOverlayResult = {
  /** 生成文件的相对路径 */
  relPath: string;
};

export type BgmOverlayPayload = {
  bgmRelPath: string;
  bgmVolume: number;
  keepOriginalAudio: boolean;
  originalVolume: number;
  loopBgm: boolean;
  fadeInSec: number;
  fadeOutSec: number;
  videoDurationSec: number;
};

function toPayload(
  bgmRelPath: string,
  settings: BgmAlignSettings,
  videoDurationSec: number,
): BgmOverlayPayload {
  return {
    bgmRelPath,
    bgmVolume: settings.bgmVolume,
    keepOriginalAudio: settings.keepOriginalAudio,
    originalVolume: settings.originalVolume,
    loopBgm: settings.loopToFit,
    fadeInSec: settings.fadeInSec,
    fadeOutSec: settings.fadeOutSec,
    videoDurationSec,
  };
}

/**
 * 调用 Rust FFmpeg 将 BGM 混入视频。
 *
 * @param projectPath 工程根目录绝对路径
 * @param videoRelPath 视频文件相对路径
 * @param bgmRelPath BGM 音频文件相对路径（需已导入工程 assets）
 * @param settings 对轨参数
 * @param videoDurationSec 视频总时长（秒）
 * @param outputRelPath 输出路径（可选，默认 assets/exports/final_with_bgm.mp4）
 */
export async function overlayBgm(
  projectPath: string,
  videoRelPath: string,
  bgmRelPath: string,
  settings: BgmAlignSettings,
  videoDurationSec: number,
  outputRelPath?: string,
): Promise<BgmOverlayResult> {
  const relPath: string = await invoke("overlay_bgm_to_video", {
    projectPath,
    videoRelPath,
    outputRelPath: outputRelPath ?? null,
    options: toPayload(bgmRelPath, settings, videoDurationSec),
  });
  return { relPath };
}
