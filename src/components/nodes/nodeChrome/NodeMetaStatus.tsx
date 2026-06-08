import { memo } from "react";

type Props = {
  /** e.g. 1920x1080 */
  dimsText?: string | null;
  generating?: boolean;
  progress?: number | null;
  /** 分阶段文案；有 progress 时可省略，组件会自行拼接 */
  generatingLabel?: string;
};

/** Top-right meta: dimensions or generation progress */
function NodeMetaStatusImpl({ dimsText, generating = false, progress, generatingLabel }: Props) {
  const showGenerating = generating;
  const showDims = Boolean(dimsText) && !showGenerating;
  if (!showGenerating && !showDims) return null;

  const text = showGenerating
    ? (generatingLabel ?? (progress != null ? `生成中 ${progress}%` : "生成中…"))
    : dimsText;

  return (
    <div
      className={`nodeChrome-metaStatus minimal-image-top-right${generating ? " nodeChrome-metaStatus--generating minimal-image-top-right--generating" : ""}`}
    >
      <span
        className={
          showGenerating
            ? "nodeChrome-metaStatus-progress minimal-image-gen-progress"
            : "nodeChrome-metaStatus-dims minimal-image-res-dims"
        }
        aria-live="polite"
      >
        {text}
      </span>
    </div>
  );
}

export const NodeMetaStatus = memo(NodeMetaStatusImpl);
