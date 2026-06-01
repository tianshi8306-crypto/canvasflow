import { useEffect, useState } from "react";
import { resolveProjectAudioPlaybackSrc } from "@/lib/projectAudioPreview";

/**
 * 音频节点预览播放地址（含 MP3 → asset/Blob 策略）。
 */
export function useProjectAudioPlaybackSrc(
  projectPath: string | null | undefined,
  relPath: string | null | undefined,
): { src: string | null; loading: boolean; failed: boolean } {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const root = projectPath?.trim();
    const rel = relPath?.trim();
    if (!root || !rel) {
      setSrc(null);
      setLoading(false);
      setFailed(false);
      return;
    }

    let cancelled = false;
    let blobUrl: string | null = null;
    setLoading(true);
    setFailed(false);

    void (async () => {
      try {
        const url = await resolveProjectAudioPlaybackSrc(root, rel);
        if (cancelled) return;
        if (url?.startsWith("blob:")) blobUrl = url;
        setSrc(url);
        if (!url) setFailed(true);
      } catch {
        if (!cancelled) {
          setSrc(null);
          setFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [projectPath, relPath]);

  return { src, loading, failed };
}
