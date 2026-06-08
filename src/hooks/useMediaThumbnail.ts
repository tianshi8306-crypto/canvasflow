import { useEffect, useState } from "react";

// ── 模块级缩略图缓存：同一条原图/视频只生成一次缩略图，跨节点共享 ──
const thumbnailCache = new Map<string, string>();

const THUMB_MAX = 256; // 缩略图最大边长
const THUMB_QUALITY = 0.55; // JPEG 质量（平衡清晰度与体积）

/**
 * 将原图/视频缩放到 THUMB_MAX，输出 JPEG data URL。
 * 结果缓存在模块 Map 中，同 src 只生成一次。
 */
async function generateImageThumbnail(src: string): Promise<string> {
  const cached = thumbnailCache.get(src);
  if (cached) return cached;

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w <= 0 || h <= 0) {
          reject(new Error("zero image size"));
          return;
        }
        // 等比缩放到 THUMB_MAX
        const scale = Math.min(1, THUMB_MAX / Math.max(w, h));
        w = Math.round(w * scale);
        h = Math.round(h * scale);

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("no canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", THUMB_QUALITY);
        thumbnailCache.set(src, dataUrl);
        resolve(dataUrl);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

async function generateVideoThumbnail(src: string): Promise<string> {
  const cached = thumbnailCache.get(src);
  if (cached) return cached;

  return new Promise<string>((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";

    let resolved = false;
    const finish = (dataUrl: string) => {
      if (resolved) return;
      resolved = true;
      try { video.pause(); } catch { /* ignore */ }
      try { video.removeAttribute("src"); video.load(); } catch { /* ignore */ }
      resolve(dataUrl);
    };

    video.onloadedmetadata = () => {
      // seek to 1s or 10% of duration
      const seekTo = Math.min(1, video.duration * 0.1);
      video.currentTime = seekTo;
    };

    video.onseeked = () => {
      try {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw <= 0 || vh <= 0) {
          finish("");
          return;
        }
        const scale = Math.min(1, THUMB_MAX / Math.max(vw, vh));
        const w = Math.round(vw * scale);
        const h = Math.round(vh * scale);

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          finish("");
          return;
        }
        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", THUMB_QUALITY);
        thumbnailCache.set(src, dataUrl);
        finish(dataUrl);
      } catch {
        finish("");
      }
    };

    video.onerror = () => finish("");
    video.src = src;
  });
}

export type ThumbnailResult = {
  thumbnailSrc: string | null; // data URL，生成中或失败时为 null
  loading: boolean; // 正在生成中
};

/**
 * 为图片/视频生成缩略图（data URL），结果跨节点缓存。
 * 未展开节点用缩略图替代原尺寸媒体，显著减少 GPU 内存占用。
 */
export function useMediaThumbnail(src: string | null, kind: "image" | "video"): ThumbnailResult {
  const [thumbnailSrc, setThumbSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!src) {
      setThumbSrc(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const generate = kind === "image" ? generateImageThumbnail : generateVideoThumbnail;
    void generate(src)
      .then((url) => {
        if (!cancelled) {
          setThumbSrc(url || null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setThumbSrc(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [src, kind]);

  return { thumbnailSrc, loading };
}
