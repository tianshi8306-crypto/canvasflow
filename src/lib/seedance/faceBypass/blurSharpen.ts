/**
 * blurSharpen.ts
 *
 * 全图模糊-锐化回弹 + JPEG 重编码 — 人脸审核通关核心算法。
 *
 * 原理：
 * 1. ctx.filter = 'blur(1.5px)' 绘制 → 破坏人脸 embedding 依赖的中频纹理
 * 2. 3×3 Unsharp Mask 锐化回弹 → 保持人类视觉一致性
 * 3. Canvas.toBlob('image/jpeg', 0.85) → EXIF 自然丢失 + MD5/phash 自动改变
 *
 * 零外部依赖，纯 Canvas 2D API。
 * 1120×768 处理 ~40ms，对生成流程影响可忽略。
 */

import { canvasToJpegDataUrl, clamp, createImageFromDataUrl } from "./helpers";

export const DEFAULT_BLUR_RADIUS = 1.5;
export const DEFAULT_SHARPEN_AMOUNT = 0.35;
export const DEFAULT_JPEG_QUALITY = 0.85;

export interface BlurSharpenOptions {
  /** 模糊半径（px），默认 1.5 */
  blurRadius?: number;
  /** USM 锐化强度，默认 0.35 */
  sharpenAmount?: number;
  /** JPEG 输出质量 0-1，默认 0.85 */
  jpegQuality?: number;
}

/**
 * 对单个 data URL 执行模糊-锐化回弹 + JPEG 重编码
 *
 * @param originalDataUrl 原始图片 data URL
 * @param options 参数覆盖
 * @returns 处理后的 data URL（image/jpeg 格式）
 */
export async function blurSharpenAndReEncode(
  originalDataUrl: string,
  options?: BlurSharpenOptions,
): Promise<string> {
  const blurRadius = options?.blurRadius ?? DEFAULT_BLUR_RADIUS;
  const sharpenAmount = options?.sharpenAmount ?? DEFAULT_SHARPEN_AMOUNT;
  const jpegQuality = options?.jpegQuality ?? DEFAULT_JPEG_QUALITY;

  // Step 1: data URL → Image
  const img = await createImageFromDataUrl(originalDataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  // Step 2: 创建离屏 Canvas 并绘制原图
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Step 3: 轻微高斯模糊（Chromium GPU 加速，<10ms）
  ctx.filter = `blur(${blurRadius}px)`;
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = "none";

  // Step 4: Unsharp Mask 锐化回弹
  if (sharpenAmount > 0) {
    applyUnsharpMask(ctx, w, h, sharpenAmount);
  }

  // Step 5: 导出为 JPEG
  // EXIF 在 Canvas 导出时自动剥离；JPEG 量化引入随机误差，MD5 自动改变
  return canvasToJpegDataUrl(canvas, jpegQuality);
}

/**
 * 3×3 Unsharp Mask 卷积
 *
 * 核公式展开:
 *   output = original + amount × (original − blur_3×3)
 *          = identity + amount×(identity − blur_3×3)
 *
 * 等效权重:
 *   中心像素 = 1 + amount × 8/9
 *   邻域像素 = -amount / 9
 *
 * 边框 1px 跳过（不影响整体效果）。
 */
function applyUnsharpMask(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  amount: number,
): void {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);

  const center = 1 + amount * (8 / 9);
  const neighbor = -amount / 9;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        // 周围 8 个邻域
        const tl = copy[((y - 1) * w + (x - 1)) * 4 + c];
        const tc = copy[((y - 1) * w + x) * 4 + c];
        const tr = copy[((y - 1) * w + (x + 1)) * 4 + c];
        const ml = copy[(y * w + (x - 1)) * 4 + c];
        const mc = copy[idx + c];
        const mr = copy[(y * w + (x + 1)) * 4 + c];
        const bl = copy[((y + 1) * w + (x - 1)) * 4 + c];
        const bc = copy[((y + 1) * w + x) * 4 + c];
        const br = copy[((y + 1) * w + (x + 1)) * 4 + c];

        const neighborSum = tl + tc + tr + ml + mr + bl + bc + br;
        const sharpened = mc * center + neighborSum * neighbor;
        data[idx + c] = clamp(sharpened, 0, 255);
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}
