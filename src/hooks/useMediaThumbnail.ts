import { useEffect, useState } from "react";
import { storeThumbnail, loadThumbnail } from "@/lib/thumbnailIdb";

// ── 模块级缩略图缓存（L1 内存）：同一条原图/视频只生成一次，跨节点共享 ──
const thumbnailCache = new Map<string, string>();

const THUMB_MAX = 256; // 缩略图最大边长
const THUMB_QUALITY = 0.55; // JPEG 质量（平衡清晰度与体积）

/**
 * 将原图/视频缩放到 THUMB_MAX，输出 JPEG data URL。
 * 优先从内存缓存读取，其次 IndexedDB 持久缓存，最后才生成。
 */
async function generateImageThumbnail(src: string): Promise<string> {
  // L1：内存缓存
  const memCached = thumbnailCache.get(src);
  if (memCached) return memCached;

  // L2：IndexedDB 持久缓存
  const idbCached = await loadThumbnail(src);
  if (idbCached) {
    thumbnailCache.set(src, idbCached);
    return idbCached;
  }

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
        void storeThumbnail(src, dataUrl); // 异步持久化，不阻塞返回
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
  const memCached = thumbnailCache.get(src);
  if (memCached) return memCached;

  const idbCached = await loadThumbnail(src);
  if (idbCached) {
    thumbnailCache.set(src, idbCached);
    return idbCached;
  }

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
        void storeThumbnail(src, dataUrl);
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
  thumbnailSrc: string | null;
  loading: boolean;
};

/**
 * 为图片/视频生成缩略图（data URL），三级缓存策略：
 *   1. 内存 Map — 同会话跨节点共享，零延迟
 *   2. IndexedDB — 跨会话持久化，重启软件后秒恢复
 *   3. 实时生成 — 首次该文件时从原图/视频实时 Canvas 缩略
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
