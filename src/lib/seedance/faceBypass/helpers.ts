/**
 * faceBypass/helpers.ts
 *
 * 纯工具函数，无副作用：
 * - HTMLImageElement ↔ data URL 编解码
 * - Canvas → JPEG data URL 导出
 */

/**
 * 从 data URL 创建 HTMLImageElement
 */
export function createImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片解码失败"));
    img.src = dataUrl;
  });
}

/**
 * 从 Canvas 导出为 data URL（JPEG 格式）
 */
export function canvasToJpegDataUrl(
  canvas: HTMLCanvasElement,
  quality = 0.85,
): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas.toBlob 返回 null"));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("FileReader 读取失败"));
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

/**
 * 值钳制到 [lo, hi]
 */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
