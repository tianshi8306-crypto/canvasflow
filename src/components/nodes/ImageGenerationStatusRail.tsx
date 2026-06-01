export type ImageGenerationStatusRailProps = {
  isGenerating: boolean;
  isCancelled?: boolean;
  errors: string[];
  showValidation: boolean;
  warnMessage?: string | null;
};

/** 校验 / 警告 / 取消 — 生成失败由灵体气泡告知，不在面板内嵌错误条 */
export function ImageGenerationStatusRail({
  isGenerating,
  isCancelled = false,
  errors,
  showValidation,
  warnMessage,
}: ImageGenerationStatusRailProps) {
  const showCancelled = isCancelled && !isGenerating;
  const showValidationBlock = showValidation && !isGenerating && !showCancelled;
  const showWarn =
    Boolean(warnMessage?.trim()) &&
    !isGenerating &&
    !showCancelled &&
    !showValidationBlock;

  if (!showCancelled && !showValidationBlock && !showWarn) {
    return null;
  }

  return (
    <div className="mmStatusRail nodrag nopan" role="region" aria-label="生成状态">
      {showCancelled ? (
        <div className="mmResultBanner mmResultBanner--cancelled mmResultBanner--rail" role="status">
          <span>生成已取消，可修改参数后再次生成</span>
        </div>
      ) : null}

      {showValidationBlock ? (
        <div className="mmValidationErrors mmValidationErrors--rail" role="alert">
          {errors.map((err, i) => (
            <div key={i}>{err}</div>
          ))}
        </div>
      ) : null}

      {showWarn ? (
        <div className="mmResultBanner mmResultBanner--warn mmResultBanner--rail" role="status">
          <span>{warnMessage}</span>
        </div>
      ) : null}
    </div>
  );
}
