/**
 * faceBypass/index.ts
 *
 * Seedance 2.0 人脸审核通关模块入口。
 *
 * 提供两个对外接口：
 * - bypassFaceReview()      处理单张参考图
 * - bypassFaceReviewBatch() 批量处理（每张图独立错误隔离）
 *
 * 每步独立 try-catch，任何步骤失败自动回退原 dataUrl，
 * 保证零影响稳定性。
 *
 * 零外部依赖，纯 Canvas 2D API + 浏览器原生 Image/FileReader。
 */

import { destroyFaceFeatures, type BlurSharpenOptions } from "./blurSharpen";

export type { BlurSharpenOptions };

export interface FaceBypassOptions extends BlurSharpenOptions {}

export interface FaceBypassResult {
  /** 处理后的 data URL（失败时回退为原值） */
  dataUrl: string;
  /** 处理耗时（ms） */
  elapsedMs: number;
  /** 是否发生了回退 */
  fallback: boolean;
  /** 回退原因（仅 fallback=true 时有值） */
  fallbackReason?: string;
}

/**
 * 处理单张参考图：四层防御管线（模糊→像素化→量化→JPEG）
 *
 * @param originalDataUrl 原始图片 data URL
 * @param options 参数覆盖
 * @returns 处理结果（含回退信息）
 */
export async function bypassFaceReview(
  originalDataUrl: string,
  options?: FaceBypassOptions,
): Promise<FaceBypassResult> {
  const t0 = performance.now();
  try {
    const dataUrl = await destroyFaceFeatures(originalDataUrl, options);
    return {
      dataUrl,
      elapsedMs: performance.now() - t0,
      fallback: false,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      dataUrl: originalDataUrl,
      elapsedMs: performance.now() - t0,
      fallback: true,
      fallbackReason: reason,
    };
  }
}

/**
 * 批量处理参考图数组。
 * 每张图独立 try-catch，一张失败不影响其他。
 *
 * @param urls 原始图片 data URL 数组
 * @param options 参数覆盖
 * @returns 与输入同长度的结果数组
 */
export async function bypassFaceReviewBatch(
  urls: string[],
  options?: FaceBypassOptions,
): Promise<FaceBypassResult[]> {
  return Promise.all(urls.map((url) => bypassFaceReview(url, options)));
}
