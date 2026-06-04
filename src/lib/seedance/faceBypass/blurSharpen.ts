/**
 * blurSharpen.ts → 人脸审核几何破坏算法
 *
 * 火山引擎 Seedance 2.0 人脸审核 **几何层破坏** 算法。
 *
 * 核心洞察：
 *   AI 人脸检测模型依赖的是五官间的**空间位置关系**（眼在上、鼻在中、嘴在下），
 *   而非像素值。模糊/压缩/量化无法改变这个空间结构，因此无效。
 *
 * 本算法通过 **块打乱（Block Scrambling）** 直接破坏人脸区域的几何连续性 —
 *   把人脸区域切成网格，随机打乱块位置。检测模型看到的不是"人脸"，
 *   而是一堆皮肤碎片的随机排列，无法构建五官空间关系。
 *
 * 提供三种模式：
 *   "scramble" 默认 — 对人脸区域做块打乱（最有效，背景/服装不受影响）
 *   "erase"   核选项 — 完全擦除人脸区域（用纯色填充）
 *   "standard" 兼容 — 模糊 + 像素化 + 量化（老策略）
 *
 * 零外部依赖。约 150~250ms/张（1120×768）。
 */

import { canvasToJpegDataUrl, createImageFromDataUrl } from "./helpers";

// ── 常量 ────────────────────────────────────────────────────

export const DEFAULT_BLUR_RADIUS = 12.0;
export const DEFAULT_SCRAMBLE_GRID = 5;
export const DEFAULT_SCRAMBLE_SHUFFLE_RATIO = 0.7;
export const DEFAULT_PIXELATE_BLOCK = 12;
export const DEFAULT_QUANTIZE_BITS = 3;
export const DEFAULT_JPEG_QUALITY = 0.15;
export const SKIN_COVERAGE_MIN_RATIO = 0.02;

/** 处理模式 */
export type FaceBypassMode = "scramble" | "erase" | "standard";

export interface BlurSharpenOptions {
  /** 处理模式：scramble（默认）| erase | standard */
  mode?: FaceBypassMode;
  blurRadius?: number;
  /** 打乱网格 N×N（仅 scramble 模式），范围 [2, 8] */
  scrambleGrid?: number;
  /** 打乱比例 [0-1]（仅 scramble 模式），0.7=随机打乱 70% 的块 */
  scrambleRatio?: number;
  pixelateBlock?: number;
  quantizeBits?: number;
  jpegQuality?: number;
}

// ── 肤色检测 ────────────────────────────────────────────────

function isSkinPixel(r: number, g: number, b: number): boolean {
  const y  =  0.299 * r + 0.587 * g + 0.114 * b;
  const cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
  const cr =  0.5 * r - 0.418688 * g - 0.081312 * b + 128;
  return y > 80 && cb > 77 && cb < 127 && cr > 133 && cr < 173;
}

function findSkinBoundingBox(
  imageData: ImageData,
): { sx: number; sy: number; sw: number; sh: number } | null {
  const { data, width, height } = imageData;
  let minX = width, minY = height, maxX = 0, maxY = 0;
  let skinCount = 0;
  const total = width * height;
  const step = 4;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      if (isSkinPixel(data[idx], data[idx + 1], data[idx + 2])) {
        skinCount++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (skinCount / (total / (step * step)) < SKIN_COVERAGE_MIN_RATIO) return null;

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  const padX = Math.round(boxW * 0.15);
  const padY = Math.round(boxH * 0.15);

  return {
    sx: Math.max(0, minX - padX),
    sy: Math.max(0, minY - padY),
    sw: Math.min(width - minX + padX, boxW + padX * 2),
    sh: Math.min(height - minY + padY, boxH + padY * 2),
  };
}

// ── 模式：scramble — 块打乱 ────────────────────────────────

/**
 * 将人脸区域划分为 grid×grid 块，随机打乱其中 shuffleRatio 比例的块。
 *
 * 原理：对人脸检测模型而言，"眼睛在鼻子上方"这个空间关系
 * 是识别的核心证据。打乱后眼睛跑到脸颊位置、嘴唇跑到额头位置，
 * 模型无法匹配任何已知的人脸关键点拓扑。
 */
function scrambleFaceRegion(
  imageData: ImageData,
  box: { sx: number; sy: number; sw: number; sh: number },
  gridSize: number,
  shuffleRatio: number,
): void {
  const { data, width } = imageData;
  const g = Math.max(2, Math.min(8, gridSize));
  const { sx, sy, sw, sh } = box;
  const ex = Math.min(sx + sw, width);
  const ey = Math.min(sy + sh, imageData.height);

  // 把区域切成 g×g 块
  const blockW = Math.max(1, Math.floor((ex - sx) / g));
  const blockH = Math.max(1, Math.floor((ey - sy) / g));

  // 收集所有块的像素数据
  interface BlockData {
    bx: number;
    by: number;
    pixels: Uint8ClampedArray;
  }
  const blocks: BlockData[] = [];

  for (let row = 0; row < g; row++) {
    for (let col = 0; col < g; col++) {
      const bx = sx + col * blockW;
      const by = sy + row * blockH;
      const bw = Math.min(blockW, ex - bx);
      const bh = Math.min(blockH, ey - by);
      const buf = new Uint8ClampedArray(4 * bw * bh);

      for (let py = 0; py < bh; py++) {
        const srcOff = ((by + py) * width + bx) * 4;
        const dstOff = py * bw * 4;
        buf.set(data.subarray(srcOff, srcOff + bw * 4), dstOff);
      }

      blocks.push({ bx, by, pixels: buf });
    }
  }

  // Fisher-Yates 打乱
  const total = blocks.length;
  const shuffleCount = Math.max(1, Math.floor(total * shuffleRatio));
  for (let i = total - 1; i >= total - shuffleCount; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  }

  // 写回打乱后的数据
  for (const block of blocks) {
    const { bx, by, pixels } = block;
    // 重新计算该块的实际尺寸（因为最后一行/列可能不满）
    let ww = blockW;
    let hh = blockH;
    if (bx + ww > ex) ww = ex - bx;
    if (by + hh > ey) hh = ey - by;

    for (let py = 0; py < hh; py++) {
      const dstOff = ((by + py) * width + bx) * 4;
      const srcOff = py * ww * 4;
      // 只写有效的像素范围
      const copyLen = Math.min(ww * 4, pixels.length - srcOff, data.length - dstOff);
      if (copyLen > 0) {
        for (let k = 0; k < copyLen; k++) {
          data[dstOff + k] = pixels[srcOff + k];
        }
      }
    }
  }
}

// ── 模式：erase — 完全擦除人脸 ──────────────────────────────

/**
 * 用人脸区域的平均肤色填充整个区域，彻底抹除人脸。
 */
function eraseFaceRegion(
  imageData: ImageData,
  box: { sx: number; sy: number; sw: number; sh: number },
): void {
  const { data, width } = imageData;
  const { sx, sy, sw, sh } = box;
  const ex = Math.min(sx + sw, width);
  const ey = Math.min(sy + sh, imageData.height);

  // 计算区域平均肤色
  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const idx = (y * width + x) * 4;
      if (isSkinPixel(data[idx], data[idx + 1], data[idx + 2])) {
        sumR += data[idx];
        sumG += data[idx + 1];
        sumB += data[idx + 2];
        count++;
      }
    }
  }

  let avgR = 200, avgG = 170, avgB = 140;
  if (count > 0) {
    avgR = Math.round(sumR / count);
    avgG = Math.round(sumG / count);
    avgB = Math.round(sumB / count);
  }

  // 用平均肤色填充整个区域，加微弱噪点避免纯色块
  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const idx = (y * width + x) * 4;
      const noise = (Math.random() - 0.5) * 12;
      data[idx]     = Math.max(0, Math.min(255, avgR + noise));
      data[idx + 1] = Math.max(0, Math.min(255, avgG + noise));
      data[idx + 2] = Math.max(0, Math.min(255, avgB + noise));
    }
  }
}

// ── mode: standard — 模糊+像素化+量化 ─────────────────────

function applyHeavyBlur(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = "none";
}

function pixelateRegion(
  imageData: ImageData,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  blockSize: number,
): void {
  const { data, width } = imageData;
  const block = Math.max(2, blockSize);
  const ex = Math.min(sx + sw, width);
  const ey = Math.min(sy + sh, imageData.height);

  for (let by = sy; by < ey; by += block) {
    for (let bx = sx; bx < ex; bx += block) {
      const refIdx = (by * width + bx) * 4;
      const rr = data[refIdx];
      const rg = data[refIdx + 1];
      const rb = data[refIdx + 2];

      const bxEnd = Math.min(bx + block, ex);
      const byEnd = Math.min(by + block, ey);
      for (let py = by; py < byEnd; py++) {
        for (let px = bx; px < bxEnd; px++) {
          const pidx = (py * width + px) * 4;
          data[pidx] = rr;
          data[pidx + 1] = rg;
          data[pidx + 2] = rb;
        }
      }
    }
  }
}

function applyColorQuantization(imageData: ImageData, bits: number): void {
  if (bits >= 8) return;
  const { data } = imageData;
  const len = data.length;
  const mask = (0xff << (8 - bits)) & 0xff;
  for (let i = 0; i < len; i += 4) {
    data[i]     = data[i]     & mask;
    data[i + 1] = data[i + 1] & mask;
    data[i + 2] = data[i + 2] & mask;
  }
}

// ── 主流程 ──────────────────────────────────────────────────

/**
 * scramble 模式：模糊 → 肤色检测 → 块打乱 → 量化 → JPEG
 * erase   模式：模糊 → 肤色检测 → 擦除人脸区域 → 量化 → JPEG
 * standard 模式：模糊 → 像素化 → 量化 → JPEG（兼容老行为）
 */
export async function destroyFaceFeatures(
  originalDataUrl: string,
  options?: BlurSharpenOptions,
): Promise<string> {
  const mode = options?.mode ?? "scramble";
  const blurRadius = options?.blurRadius ?? DEFAULT_BLUR_RADIUS;
  const scrambleGrid = options?.scrambleGrid ?? DEFAULT_SCRAMBLE_GRID;
  const scrambleRatio = options?.scrambleRatio ?? DEFAULT_SCRAMBLE_SHUFFLE_RATIO;
  const pixelateBlock = options?.pixelateBlock ?? DEFAULT_PIXELATE_BLOCK;
  const quantizeBits = options?.quantizeBits ?? DEFAULT_QUANTIZE_BITS;
  const jpegQuality = options?.jpegQuality ?? DEFAULT_JPEG_QUALITY;

  const img = await createImageFromDataUrl(originalDataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Step 1: 强力模糊（所有模式都做，打散中频纹理）
  applyHeavyBlur(ctx, img, w, h, blurRadius);

  // Step 2: 肤色检测 + 模式特定处理
  const imageData = ctx.getImageData(0, 0, w, h);
  const box = findSkinBoundingBox(imageData);

  if (box) {
    if (mode === "scramble") {
      scrambleFaceRegion(imageData, box, scrambleGrid, scrambleRatio);
    } else if (mode === "erase") {
      eraseFaceRegion(imageData, box);
    } else if (mode === "standard") {
      pixelateRegion(imageData, box.sx, box.sy, box.sw, box.sh, pixelateBlock);
    }
  }
  ctx.putImageData(imageData, 0, 0);

  // Step 3: 颜色量化
  if (quantizeBits > 0 && quantizeBits < 8) {
    const qData = ctx.getImageData(0, 0, w, h);
    applyColorQuantization(qData, quantizeBits);
    ctx.putImageData(qData, 0, 0);
  }

  // Step 4: 激进 JPEG
  return canvasToJpegDataUrl(canvas, jpegQuality);
}
