import { NodeMetaLabel } from "./NodeMetaLabel";
import { NodeMetaStatus } from "./NodeMetaStatus";

type Props = {
  label?: string;
  defaultLabel: string;
  onCommitLabel: (label: string | undefined) => void;
  dimsText?: string | null;
  generating?: boolean;
  progress?: number | null;
  generatingLabel?: string;
};

/** 预览顶栏 Portal 栈内元信息行（LibTV：功能栏 → 小间距 → 标签/状态 → 预览） */
export function NodePreviewChromeMeta({
  label = "",
  defaultLabel,
  onCommitLabel,
  dimsText,
  generating = false,
  progress,
  generatingLabel,
}: Props) {
  const showStatus = generating || Boolean(dimsText);

  return (
    <div className="nodePreviewChromeMeta">
      <NodeMetaLabel
        label={label}
        defaultLabel={defaultLabel}
        onCommit={onCommitLabel}
        variant="inline"
      />
      {showStatus ? (
        <NodeMetaStatus
          dimsText={dimsText}
          generating={generating}
          progress={progress}
          generatingLabel={generatingLabel}
        />
      ) : (
        <span className="nodePreviewChromeMeta-spacer" aria-hidden />
      )}
    </div>
  );
}
