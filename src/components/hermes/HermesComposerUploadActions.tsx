import type { HermesComposerUploadPending } from "@/lib/hermes/hermesComposerUpload";
import { composerUploadHasBlock } from "@/lib/hermes/hermesComposerUpload";

type Props = {
  pending: HermesComposerUploadPending;
  disabled?: boolean;
  onWriteOnly: () => void;
  onWriteAndParse: () => void;
  onDismiss: () => void;
};

/** 待确认剧本：composer 上方操作条（非自动覆盖） */
export function HermesComposerUploadActions({
  pending,
  disabled = false,
  onWriteOnly,
  onWriteAndParse,
  onDismiss,
}: Props) {
  const blocked = composerUploadHasBlock(pending.analysis);

  return (
    <div className="hermesComposerUploadActions" role="region" aria-label="剧本导入确认">
      <span className="hermesComposerUploadLabel">
        {pending.extract.fileName}
        {pending.analysis.truncated ? " · 将截断" : ""}
      </span>
      <div className="hermesComposerUploadBtns">
        <button
          type="button"
          className="hermesComposerUploadBtn"
          disabled={disabled || blocked}
          onClick={onWriteOnly}
        >
          写入脚本
        </button>
        <button
          type="button"
          className="hermesComposerUploadBtn hermesComposerUploadBtn--primary"
          disabled={disabled || blocked}
          onClick={onWriteAndParse}
        >
          导入并解析
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
