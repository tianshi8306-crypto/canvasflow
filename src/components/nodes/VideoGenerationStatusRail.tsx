import { IgpGenerateButtonIcon } from "@/components/nodes/IgpGenerateButtonIcon";

export type VideoGenerationStatusRailProps = {
  isGenerating: boolean;
  isCancelled?: boolean;
  errors: string[];
  showValidation: boolean;
};

/** 校验 / 取消 — 生成失败由灵体气泡告知，不在面板内嵌错误条 */
export function VideoGenerationStatusRail({
  isGenerating,
  isCancelled = false,
  errors,
  showValidation,
}: VideoGenerationStatusRailProps) {
  const showCancelled = isCancelled && !isGenerating;
  const showValidationBlock = showValidation && !isGenerating && !showCancelled;

  if (!showCancelled && !showValidationBlock) {
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
    </div>
  );
}

/** 生成钮内图标：LibTV 白圆上箭头；生成中为停止方块 */
export function VideoGenerateButtonIconState(props: {
  isGenerating: boolean;
}) {
  return <IgpGenerateButtonIcon generating={props.isGenerating} />;
}
