import { TextNodeFormatToolbar } from "@/components/nodes/TextNodeFormatToolbar";

export type TextPreviewToolbarCallbacks = {
  onFormatExec: (command: string, value?: string) => void;
  showFormat?: boolean;
  onSyncFromScript?: () => void;
  onCopyBody?: () => void;
  onExpandEdit?: () => void;
  onPasteImport?: () => void;
  onDownloadBody?: () => void;
};

function IconCopy() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M5.5 2.5h6a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 4 10V4a1.5 1.5 0 0 1 1.5-1.5Zm1 2v5h4V5h-4ZM3 6.5v6a1.5 1.5 0 0 0 1.5 1.5h6v-1H4.5a.5.5 0 0 1-.5-.5v-6H3Z"
      />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        d="M4 6V4h2M10 4h2v2M12 10v2h-2M6 12H4v-2M4 4l2.5 2.5M12 4 9.5 6.5M12 12 9.5 9.5M4 12 6.5 9.5"
      />
    </svg>
  );
}

function IconPaste() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M4.5 2h5.2A1.5 1.5 0 0 1 11 3.5V5h1.5A1.5 1.5 0 0 1 14 6.5v6A1.5 1.5 0 0 1 12.5 14h-6A1.5 1.5 0 0 1 5 12.5v-1H3.5A1.5 1.5 0 0 1 2 10V3.5A1.5 1.5 0 0 1 3.5 2Zm0 1.5v6H5V3.5a.5.5 0 0 0-.5-.5Zm2 2h5v6.5a.5.5 0 0 1-.5.5h-6a.5.5 0 0 1-.5-.5V6.5Z"
      />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        d="M8 3v7m0 0 2.5-2.5M8 10 5.5 7.5M4 12.5h8"
      />
    </svg>
  );
}

function IconSync() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        d="M12.5 2.5v3h-3M3.5 13.5v-3h3M12.8 5.2A5 5 0 0 0 4 6.5M3.2 10.8A5 5 0 0 0 12 9.5"
      />
    </svg>
  );
}

type Props = TextPreviewToolbarCallbacks;

/** 文本节点预览顶栏：单层胶囊 + 纯图标按钮（含义见 title / aria-label） */
export function TextPreviewToolbar({
  onFormatExec,
  showFormat = true,
  onSyncFromScript,
  onCopyBody,
  onExpandEdit,
  onPasteImport,
  onDownloadBody,
}: Props) {
  const showUtils = Boolean(
    onSyncFromScript || onCopyBody || onExpandEdit || onPasteImport || onDownloadBody,
  );

  return (
    <div
      className="textPreviewToolbar"
      role="toolbar"
      aria-label="文本工具"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="textPreviewToolbarScroll">
        {showFormat ? <TextNodeFormatToolbar variant="inline" onExec={onFormatExec} /> : null}
        {showFormat && showUtils ? <div className="textPreviewToolbar-divider" aria-hidden /> : null}
        {!showFormat && onSyncFromScript && showUtils ? (
          <div className="textPreviewToolbar-divider" aria-hidden />
        ) : null}
        {showUtils ? (
          <div className="textPreviewToolbar-utils">
            {onSyncFromScript ? (
              <button
                type="button"
                className="textPreviewToolbar-iconBtn"
                title="从上游脚本同步正文"
                aria-label="从上游脚本同步正文"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onSyncFromScript}
              >
                <IconSync />
              </button>
            ) : null}
            {onCopyBody ? (
              <button
                type="button"
                className="textPreviewToolbar-iconBtn"
                title="复制正文"
                aria-label="复制正文"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onCopyBody}
              >
                <IconCopy />
              </button>
            ) : null}
            {onExpandEdit ? (
              <button
                type="button"
                className="textPreviewToolbar-iconBtn"
                title="展开编辑"
                aria-label="展开编辑"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onExpandEdit}
              >
                <IconExpand />
              </button>
            ) : null}
            {onPasteImport ? (
              <button
                type="button"
                className="textPreviewToolbar-iconBtn"
                title="粘贴导入"
                aria-label="粘贴导入"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onPasteImport}
              >
                <IconPaste />
              </button>
            ) : null}
            {onDownloadBody ? (
              <button
                type="button"
                className="textPreviewToolbar-iconBtn"
                title="下载正文 (.txt)"
                aria-label="下载正文"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onDownloadBody}
              >
                <IconDownload />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
