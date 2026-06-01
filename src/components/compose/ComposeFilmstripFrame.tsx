import { useEffect, useMemo, useRef, useState } from "react";
import { useResolvedAssetRelPath } from "@/hooks/useResolvedAssetRelPath";
import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  relPath: string;
  seekSec: number;
};

/** 单格胶片：加载后 seek 到指定时间显示该帧 */
export function ComposeFilmstripFrame({ relPath, seekSec }: Props) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const { effectiveRelPath, loading } = useResolvedAssetRelPath(relPath, undefined);
  const src = useMemo(
    () => resolveProjectAssetSrc(projectPath, effectiveRelPath ?? undefined),
    [projectPath, effectiveRelPath],
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [src]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    const apply = () => {
      const d = v.duration;
      const t =
        Number.isFinite(d) && d > 0
          ? Math.min(Math.max(0, seekSec), Math.max(0, d - 0.04))
          : Math.max(0, seekSec);
      try {
        v.currentTime = t;
      } catch {
        /* ignore */
      }
    };
    if (v.readyState >= 1) apply();
    else v.addEventListener("loadedmetadata", apply, { once: true });
  }, [src, seekSec]);

  if (loading) {
    return <div className="composeFilmstripFrame composeFilmstripFrame--placeholder" />;
  }
  if (!src || broken) {
    return <div className="composeFilmstripFrame composeFilmstripFrame--placeholder" />;
  }

  return (
    <video
      ref={videoRef}
      src={src}
      className="composeFilmstripFrame"
      muted
      playsInline
      preload="metadata"
      aria-hidden
      onError={() => setBroken(true)}
    />
  );
}
