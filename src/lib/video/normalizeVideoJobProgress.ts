/** 将后端 progress（0~1 或 0~100）规范为 UI 用的 0~99 整数百分比 */
export function normalizeVideoJobProgress(
  raw: number | null | undefined,
): number | undefined {
  if (raw == null || !Number.isFinite(raw)) return undefined;
  const scaled = raw > 0 && raw <= 1 ? raw * 100 : raw;
  return Math.round(Math.min(99, Math.max(0, scaled)));
}

/** 合并 activeJob 与节点 status 上的进度，取较大值 */
export function resolveVideoGenerationProgressPercent(
  activeJobProgress: number | null | undefined,
  nodeStatusProgress: number | null | undefined,
): number | undefined {
  const a = normalizeVideoJobProgress(activeJobProgress);
  const b = normalizeVideoJobProgress(nodeStatusProgress);
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}
