import { useMemo } from "react";
import { useResolvedAssetRelPath } from "@/hooks/useResolvedAssetRelPath";
import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";
import { useProjectStore } from "@/store/projectStore";

type Props = {
  relPath: string;
  onDuration: (relPath: string, sec: number) => void;
};

/** 隐藏 video，仅用于读取片段时长 */
export function ComposeClipDurationProbe({ relPath, onDuration }: Props) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const { effectiveRelPath, loading } = useResolvedAssetRelPath(relPath, undefined);
  const src = useMemo(
    () => resolveProjectAssetSrc(projectPath, effectiveRelPath ?? undefined),
    [projectPath, effectiveRelPath],
  );

  if (loading || !src) return null;

  return (
    <video
      className="composeTimelineClipMetaProbe"
      src={src}
      muted
      playsInline
      preload="metadata"
      aria-hidden
      onLoadedMetadata={(e) => {
        const d = e.currentTarget.duration;
        if (Number.isFinite(d) && d > 0) onDuration(relPath, d);
      }}
    />
  );
}
