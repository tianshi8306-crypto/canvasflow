import { useState } from "react";
import { IgpGenerateButtonIcon } from "@/components/nodes/IgpGenerateButtonIcon";
import {
  parseVideoGenError,
  videoGenErrorTechnicalDetail,
} from "@/lib/video/formatVideoGenError";

export type VideoGenerationStatusRailProps = {
  isGenerating: boolean;
  isCancelled?: boolean;
  isFailed?: boolean;
  failureError?: string | null;
  errors: string[];
  showValidation: boolean;
};

/** 校验 / 取消 / 生成失败 — 失败摘要内嵌展示，灵体气泡作补充提醒 */
export function VideoGenerationStatusRail({
  isGenerating,
  isCancelled = false,
  isFailed = false,
  failureError,
  errors,
  showValidation,
}: VideoGenerationStatusRailProps) {
  const [showTechnical, setShowTechnical] = useState(false);
  const showCancelled = isCancelled && !isGenerating;
  const showValidationBlock = showValidation && !isGenerating && !showCancelled;
  const failureRaw = failureError?.trim() ?? "";
  const showFailed = isFailed && !isGenerating && failureRaw.length > 0;
  const failureSummary = showFailed ? parseVideoGenError(failureRaw).summary : null;
  const failureTechnical = showFailed ? videoGenErrorTechnicalDetail(failureRaw) : undefined;
  const showTechnicalToggle =
    Boolean(failureTechnical?.trim()) &&
    failureTechnical!.trim() !== failureSummary?.trim();

  if (!showCancelled && !showValidationBlock && !showFailed) {
    return null;
  }

  return (
    <div className="mmStatusRail nodrag nopan" role="region" aria-label="生成状态">
      {showCancelled ? (
        <div className="mmResultBanner mmResultBanner--cancelled mmResultBanner--rail" role="status">
          <span>生成已取消，可修改参数后再次生成</span>
        </div>
      ) : null}

      {showFailed && failureSummary ? (
        <div className="mmFailureErrors mmValidationErrors--rail" role="alert">
          <div className="mmFailureErrorItem">{failureSummary}</div>
          {showTechnicalToggle ? (
            <div className="mmFailureTechnicalWrap">
              <button
                type="button"
                className="mmFailureTechnicalToggle"
                onClick={() => setShowTechnical((open) => !open)}
              >
                {showTechnical ? "收起技术详情" : "查看技术详情"}
              </button>
              {showTechnical ? (
                <div className="mmFailureTechnicalBody">
                  <pre className="mmFailureTechnicalLine">{failureTechnical}</pre>
                </div>
              ) : null}
            </div>
          ) : failureTechnical ? (
            <pre className="mmFailureTechnicalLine mmFailureTechnicalLine--solo">{failureTechnical}</pre>
          ) : null}
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
