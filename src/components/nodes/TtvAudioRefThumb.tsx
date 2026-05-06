import { fileBasename } from "@/lib/paths";
import { useResolvedAssetRelPath } from "@/hooks/useResolvedAssetRelPath";

/** 参考音频：小格内图标 + 文件名摘要（与视频缩略条风格一致） */
export function TtvAudioRefThumb({
  relPath,
  assetId,
}: {
  relPath: string;
  assetId?: string;
}) {
  const { effectiveRelPath, loading } = useResolvedAssetRelPath(relPath, assetId);
  const displayPath = effectiveRelPath ?? relPath;
  const name = fileBasename(displayPath) || displayPath || "音频";
  const short = name.length > 14 ? `${name.slice(0, 12)}…` : name;
  if (loading) {
    return (
      <div className="textNodeTtvRefAudioPh">
        <span className="nodeMutedPreview" style={{ fontSize: 10 }}>
          解析…
        </span>
      </div>
    );
  }
  return (
    <div className="textNodeTtvRefAudioPh">
      <span className="textNodeTtvRefAudioGlyph" aria-hidden>
        ♪
      </span>
      <span className="textNodeTtvRefAudioName mono" title={name}>
        {short}
      </span>
    </div>
  );
}
