/**
 * testExports.ts
 *
 * 仅用于单元测试 — 导出 blurSharpen.ts 中不应公开的内部函数。
 * 不要在生产代码中导入此文件。
 */

/**
 * RGB 单通道颜色量化。
 * 保留 top `bits` 位，低位清零。
 */
export function quantizeChannelForTest(value: number, bits: number): number {
  if (bits >= 8) return value;
  const mask = (0xff << (8 - bits)) & 0xff;
  return value & mask;
}

/**
 * YCbCr 肤色检测 — 判断 (R,G,B) 是否属于肤色范围。
 * 与 blurSharpen.ts 中的 isSkinPixel 完全相同的算法。
 */
export function isSkinPixelForTest(r: number, g: number, b: number): boolean {
  const y  =  0.299 * r + 0.587 * g + 0.114 * b;
  const cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
  const cr =  0.5 * r - 0.418688 * g - 0.081312 * b + 128;
  return y > 80 && cb > 77 && cb < 127 && cr > 133 && cr < 173;
}
