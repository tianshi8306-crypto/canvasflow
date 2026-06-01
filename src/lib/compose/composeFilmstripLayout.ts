/** 胶片条单元格数量（随片段像素宽度） */
export function filmstripCellCount(widthPx: number): number {
  return Math.min(14, Math.max(4, Math.floor(widthPx / 48)));
}

/** 在片段 in～out 区间内均匀取 N 个 seek 时间点 */
export function filmstripSeekTimes(
  inSec: number,
  durationSec: number,
  count: number,
): number[] {
  if (count <= 0 || durationSec <= 0) return [inSec];
  return Array.from({ length: count }, (_, i) => {
    const ratio = (i + 0.5) / count;
    return inSec + ratio * durationSec;
  });
}
