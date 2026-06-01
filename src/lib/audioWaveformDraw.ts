/** 从 PCM 提取峰值包络（比单纯 RMS 更接近真实波形） */
export function downsamplePeaks(pcm: Float32Array, bins: number): number[] {
  if (!pcm.length || bins <= 0) return [];
  const windowSize = Math.max(1, Math.ceil(pcm.length / bins));
  const out: number[] = [];
  for (let i = 0; i < bins; i++) {
    const start = i * windowSize;
    const end = Math.min(pcm.length, start + windowSize);
    let peak = 0;
    for (let j = start; j < end; j++) {
      peak = Math.max(peak, Math.abs(pcm[j]!));
    }
    out.push(peak);
  }
  const max = Math.max(...out, 0.001);
  return out.map((v) => {
    const n = v / max;
    return Math.max(0.06, Math.min(1, Math.pow(n, 0.82)));
  });
}

/** 将峰值数组重采样到目标柱数（画布宽度变化时复用同一份解码数据） */
export function resamplePeaks(peaks: number[], columns: number): number[] {
  if (columns <= 0) return [];
  if (peaks.length === 0) return new Array(columns).fill(0.12);
  if (peaks.length === columns) return peaks;
  const out: number[] = [];
  for (let i = 0; i < columns; i++) {
    const t = (i / Math.max(1, columns - 1)) * (peaks.length - 1);
    const i0 = Math.floor(t);
    const i1 = Math.min(peaks.length - 1, i0 + 1);
    const f = t - i0;
    out.push(peaks[i0]! * (1 - f) + peaks[i1]! * f);
  }
  return out;
}

export type PaintWaveformOptions = {
  peaks: number[];
  progress: number;
  loading?: boolean;
};

const COL_W = 2;
const COL_GAP = 1;

/**
 * 在 canvas 上绘制对称峰值波形：已播放区略亮，未播放区灰；红色播放指针。
 */
export function paintAudioWaveform(
  canvas: HTMLCanvasElement,
  { peaks, progress, loading = false }: PaintWaveformOptions,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (cssW <= 0 || cssH <= 0) return;

  const w = Math.floor(cssW * dpr);
  const h = Math.floor(cssH * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const mid = cssH / 2;
  const padX = 6;
  const padY = 10;
  const drawW = cssW - padX * 2;
  const maxAmp = mid - padY;
  const columns = Math.max(16, Math.floor(drawW / (COL_W + COL_GAP)));
  const samples = resamplePeaks(peaks.length ? peaks : new Array(64).fill(0.15), columns);
  const prog = Math.min(1, Math.max(0, progress));

  if (loading) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.fillRect(padX, padY, drawW, cssH - padY * 2);
  }

  for (let i = 0; i < columns; i++) {
    const x = padX + i * (COL_W + COL_GAP);
    const amp = samples[i]! * maxAmp;
    const top = mid - amp;
    const barH = amp * 2;
    const center = (x + COL_W / 2) / cssW;
    const played = center <= prog + 0.001;

    ctx.fillStyle = played
      ? "rgba(203, 213, 225, 0.72)"
      : "rgba(100, 116, 139, 0.42)";
    if (loading) {
      ctx.fillStyle = played
        ? "rgba(148, 163, 184, 0.35)"
        : "rgba(71, 85, 105, 0.28)";
    }

    const barHeight = Math.max(2, barH);
    if (typeof ctx.roundRect === "function") {
      const r = Math.min(COL_W / 2, 1.5);
      ctx.beginPath();
      ctx.roundRect(x, top, COL_W, barHeight, r);
      ctx.fill();
    } else {
      ctx.fillRect(x, top, COL_W, barHeight);
    }
  }

  const playX = padX + prog * drawW;
  ctx.save();
  ctx.shadowColor = "rgba(239, 68, 68, 0.55)";
  ctx.shadowBlur = 6;
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(playX - 0.5, padY, 1.5, cssH - padY * 2);
  ctx.restore();

  ctx.fillStyle = "#f87171";
  ctx.beginPath();
  ctx.arc(playX, mid, 3, 0, Math.PI * 2);
  ctx.fill();
}
