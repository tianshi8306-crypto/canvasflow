/** 音频对轨参数 */
export type BgmAlignSettings = {
  /** BGM 相对视频原声的音量比例（0~1，默认 0.3 = 30%） */
  bgmVolume: number;
  /** 是否保留视频原声（true=混合，false=仅 BGM 替换） */
  keepOriginalAudio: boolean;
  /** 原声保留时的音量比例（0~1，默认 1.0） */
  originalVolume: number;
  /** 是否自动循环 BGM 以匹配视频时长 */
  loopToFit: boolean;
  /** 淡入时长（秒），默认 1.5 */
  fadeInSec: number;
  /** 淡出时长（秒），默认 2.0 */
  fadeOutSec: number;
};

export const DEFAULT_BGM_ALIGN: BgmAlignSettings = {
  bgmVolume: 0.3,
  keepOriginalAudio: true,
  originalVolume: 1.0,
  loopToFit: true,
  fadeInSec: 1.5,
  fadeOutSec: 2.0,
};

/**
 * 计算 BGM 循环布局信息。
 * 返回 null 表示无法计算（无效参数）。
 */
export type BgmLoopLayout = {
  bgmDurationSec: number;
  videoDurationSec: number;
  /** 需要循环的次数（含首次播放，>=1） */
  loopCount: number;
  /** 淡出起始时间（秒），相对于视频时长 */
  fadeOutStartSec: number;
};

export function computeBgmLoopLayout(
  videoDurationSec: number,
  bgmDurationSec: number,
  settings: BgmAlignSettings,
): BgmLoopLayout | null {
  if (!Number.isFinite(videoDurationSec) || videoDurationSec <= 0) return null;
  if (!Number.isFinite(bgmDurationSec) || bgmDurationSec <= 0) return null;

  const loopCount = settings.loopToFit && bgmDurationSec < videoDurationSec
    ? Math.ceil(videoDurationSec / bgmDurationSec)
    : 1;

  return {
    bgmDurationSec,
    videoDurationSec,
    loopCount,
    fadeOutStartSec: Math.max(0, videoDurationSec - settings.fadeOutSec),
  };
}

/**
 * 生成 FFmpeg 覆盖 BGM 的命令行参数数组。
 * 不管理 FFmpeg 进程调用（由 Rust 端处理），仅提供参数生成逻辑供测试和前端预览。
 */
export function buildBgmOverlayArgs(
  settings: BgmAlignSettings,
  videoDurationSec: number,
  loopToFit: boolean,
): {
  filterComplex: string;
  streamLoop: string;
} {
  const fadeOutSt = Math.max(0, videoDurationSec - settings.fadeOutSec);
  const bgmVol = Math.max(0, Math.min(1, settings.bgmVolume));
  const origVol = settings.keepOriginalAudio
    ? Math.max(0, Math.min(1, settings.originalVolume))
    : -1;

  const filterParts: string[] = [];

  // BGM 链：淡入 + 音量
  const bgmChain: string[] = [];
  if (settings.fadeInSec > 0) {
    bgmChain.push(`afade=t=in:st=0:d=${settings.fadeInSec.toFixed(2)}`);
  }
  bgmChain.push(`volume=${bgmVol.toFixed(3)}`);
  filterParts.push(`[1:a]${bgmChain.join(",")}[bgm]`);

  // 原声链
  if (origVol >= 0) {
    filterParts.push(`[0:a]volume=${origVol.toFixed(3)}[orig]`);
  }

  // 混合
  let mix = "";
  if (origVol >= 0) {
    mix = `[orig][bgm]amix=inputs=2:duration=first:dropout_transition=0`;
  } else {
    mix = `[bgm]anull`;
  }

  // 全局淡出
  if (settings.fadeOutSec > 0) {
    mix += `,afade=t=out:st=${fadeOutSt.toFixed(2)}:d=${settings.fadeOutSec.toFixed(2)}`;
  }

  filterParts.push(`${mix}[outa]`);

  return {
    filterComplex: filterParts.join(";"),
    streamLoop: loopToFit ? "-1" : "0",
  };
}
