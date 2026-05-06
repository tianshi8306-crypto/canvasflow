import { useMemo, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { resolveProjectAssetSrc } from "@/lib/projectMediaUrl";
import { useResolvedAssetRelPath } from "@/hooks/useResolvedAssetRelPath";

/** 视频参考条内：静音、无控件，显示首帧附近画面作缩略 */
export function TtvVideoRefThumb({
  relPath,
  assetId,
}: {
  relPath: string;
  assetId?: string;
}) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const { effectiveRelPath, loading } = useResolvedAssetRelPath(relPath, assetId);
  const src = useMemo(
    () => resolveProjectAssetSrc(projectPath, effectiveRelPath ?? undefined),
    [projectPath, effectiveRelPath],
  );
  const [broken, setBroken] = useState(false);

  const hasRef = Boolean(relPath?.trim() || assetId?.trim());
  if (!hasRef) {
    return <div className="nodeMutedPreview">未设置路径</div>;
  }
  if (!projectPath) {
    return <div className="nodeMutedPreview">打开工程后可预览</div>;
  }
  if (loading) {
    return <div className="nodeMutedPreview">解析素材…</div>;
  }
  if (!effectiveRelPath) {
    return <div className="nodeMutedPreview">未找到素材</div>;
  }
  if (!src || broken) {
    return <div className="nodeMutedPreview">{broken ? "预览失败" : "无法解析"}</div>;
  }

  return (
    <video
      src={src}
      className="textNodeTtvRefVideoThumb"
      muted
      playsInline
      preload="metadata"
      onError={() => setBroken(true)}
    />
  );
}
