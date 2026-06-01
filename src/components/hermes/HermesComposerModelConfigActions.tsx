import type { ModelApiConfigFileParseResult } from "@/lib/hermes/agent/hermesModelApiConfigFile";

type Props = {
  pending: ModelApiConfigFileParseResult;
  disabled?: boolean;
  onImport: () => void;
  onDismiss: () => void;
};

/** 待确认模型配置：composer 上方操作条 */
export function HermesComposerModelConfigActions({
  pending,
  disabled = false,
  onImport,
  onDismiss,
}: Props) {
  const laneSummary = [...new Set(pending.drafts.map((d) => d.lane))].join("、");

  return (
    <div className="hermesComposerUploadActions" role="region" aria-label="模型配置导入确认">
      <span className="hermesComposerUploadLabel">
        {pending.fileName}
        {pending.drafts.length > 0
          ? ` · ${pending.drafts.length} 项${laneSummary ? `（${laneSummary}）` : ""}`
          : " · 未识别有效字段"}
      </span>
      <div className="hermesComposerUploadBtns">
        <button
          type="button"
          className="hermesComposerUploadBtn hermesComposerUploadBtn--primary"
          disabled={disabled || pending.drafts.length === 0}
          onClick={onImport}
        >
          导入配置
        </button>
        <button
          type="button"
          className="hermesComposerUploadBtn hermesComposerUploadBtn--ghost"
          disabled={disabled}
          onClick={onDismiss}
        >
          取消
        </button>
      </div>
    </div>
  );
}
