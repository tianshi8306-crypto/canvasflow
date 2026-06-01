type Props = {
  selectedCount: number;
  totalCount: number;
  storyboardBusy?: boolean;
  onGenerateStoryboard: () => void;
  onSendToStoryboard: () => void;
};

/** 卡片视图顶栏：勾选摘要 + 分镜快捷操作 */
export function ScriptWorkbenchCardToolbar({
  selectedCount,
  totalCount,
  storyboardBusy = false,
  onGenerateStoryboard,
  onSendToStoryboard,
}: Props) {
  const scopeHint =
    selectedCount > 0
      ? `已选 ${selectedCount} / ${totalCount} 镜（生成分镜仅处理勾选）`
      : `共 ${totalCount} 镜（未勾选则处理全部）`;

  return (
    <div className="scriptCardToolbar" role="toolbar" aria-label="卡片视图操作">
      <span className="scriptCardToolbarHint">{scopeHint}</span>
      <div className="scriptCardToolbarActions">
        <button
          type="button"
          className="btn btnPrimary"
          disabled={totalCount === 0 || storyboardBusy}
          onClick={onGenerateStoryboard}
          title="为勾选镜头（无勾选则全部）生成分镜文案"
        >
          {storyboardBusy ? "分镜生成中…" : "生成分镜"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={onSendToStoryboard}
          title="同步勾选并滚动到侧栏分镜区"
        >
          进入分镜区
        </button>
      </div>
    </div>
  );
}
