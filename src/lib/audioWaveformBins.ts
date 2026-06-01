/** 解码峰值采样数：随时长略增，短音频不糊、长音频不丢细节 */
export function waveformDecodeBins(durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 200;
  return Math.min(480, Math.max(96, Math.round(durationSec * 12)));
}
