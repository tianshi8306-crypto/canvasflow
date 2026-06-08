import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { downsamplePeaks } from "@/lib/audioWaveformDraw";
import { waveformDecodeBins } from "@/lib/audioWaveformBins";
import { readProjectAudioBytes } from "@/lib/projectAudioPreview";

// ── 模块级 Peaks 缓存：同一音频素材跨多个节点共享解码结果 ──
const peaksCache = new Map<string, number[]>();

function cacheKey(projectPath: string, relPath: string): string {
  return `${projectPath}::${relPath}`;
}

async function decodePeaksFromBuffer(buf: ArrayBuffer): Promise<number[]> {
  const Ctx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new Error("AudioContext unavailable");
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(buf.slice(0));
    const raw = decoded.getChannelData(0);
    const bins = waveformDecodeBins(decoded.duration);
    return downsamplePeaks(raw, bins);
  } finally {
    void ctx.close();
  }
}

/**
 * 从工程文件解码波形峰值（与播放 URL 解耦，避免 MP3 data URL / asset fetch 限制）。
 * 结果缓存在模块级 Map 中，同一文件跨节点复用时不再重复解码。
 */
export function useAudioWaveformPeaks(
  projectPath: string | null | undefined,
  relPath: string | null | undefined,
  playbackSrc: string | null | undefined,
): { peaks: number[]; loading: boolean } {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const root = projectPath?.trim();
    const rel = relPath?.trim();
    if (!root || !rel) {
      setPeaks([]);
      setLoading(false);
      return;
    }

    // 检查缓存命中
    const key = cacheKey(root, rel);
    const cached = peaksCache.get(key);
    if (cached) {
      setPeaks(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        let samples: number[] = [];
        if (isTauri()) {
          const buf = await readProjectAudioBytes(root, rel);
          if (!cancelled) samples = await decodePeaksFromBuffer(buf);
        } else if (playbackSrc) {
          const res = await fetch(playbackSrc);
          if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
          const buf = await res.arrayBuffer();
          if (!cancelled) samples = await decodePeaksFromBuffer(buf);
        }
        if (!cancelled) {
          peaksCache.set(key, samples); // 写入缓存
          setPeaks(samples);
        }
      } catch {
        if (!cancelled) setPeaks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectPath, relPath, playbackSrc]);

  return { peaks, loading: loading };
}
