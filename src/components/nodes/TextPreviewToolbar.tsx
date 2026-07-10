import { TextNodeFormatToolbar } from "@/components/nodes/TextNodeFormatToolbar";
import { IconCopyBody, IconExpandPreview } from "@/components/nodes/TextFormatToolbarIcons";

export type TextPreviewToolbarCallbacks = {
  onFormatExec: (command: string, value?: string) => void;
  showFormat?: boolean;
  onCopyBody?: () => void;
  onExpandEdit?: () => void;
};

type Props = TextPreviewToolbarCallbacks;

/**
 * 文本节点预览顶栏（参考图一未展开 / 图二全屏展开）
 * 标题/正文 → 加粗斜体 → 列表 → 分割线 → 复制 →（节点内）展开
 */
export function TextPreviewToolbar({
  onFormatExec,
  showFormat = true,
  onCopyBody,
  onExpandEdit,
}: Props) {
  const showUtils = Boolean(onCopyBody || onExpandEdit);

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
        {showUtils ? (
          <div className="textPreviewToolbar-utils">
            {onCopyBody ? (
              <button
                type="button"
                className="textPreviewToolbar-iconBtn"
                title="复制内容"
                aria-label="复制内容"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onCopyBody}
              >
                <IconCopyBody />
              </button>
            ) : null}
            {onExpandEdit ? (
              <button
                type="button"
                className="textPreviewToolbar-iconBtn"
                title="展开"
                aria-label="展开"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onExpandEdit}
              >
                <IconExpandPreview />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
