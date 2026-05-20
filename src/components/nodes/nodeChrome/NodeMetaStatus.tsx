type Props = {
  /** e.g. 1920x1080 */
  dimsText?: string | null;
  generating?: boolean;
  progress?: number | null;
};

/** Top-right meta: dimensions or generation progress */
export function NodeMetaStatus({ dimsText, generating = false, progress }: Props) {
  const showProgress = generating && progress != null;
  const showDims = Boolean(dimsText) && !showProgress;
  if (!showProgress && !showDims) return null;

  return (
    <div
      className={`nodeChrome-metaStatus minimal-image-top-right${generating ? " nodeChrome-metaStatus--generating minimal-image-top-right--generating" : ""}`}
    >
      {showProgress ? (
        <span className="nodeChrome-metaStatus-progress minimal-image-gen-progress" aria-live="polite">
          {"\u751f\u6210\u4e2d "}
          {progress}%
        </span>
      ) : (
        <span className="nodeChrome-metaStatus-dims minimal-image-res-dims">{dimsText}</span>
      )}
    </div>
  );
}
