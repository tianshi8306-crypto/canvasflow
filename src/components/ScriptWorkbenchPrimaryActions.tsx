type Props = {
  view: "table" | "card";
  setView: (view: "table" | "card") => void;
  onOpenFullscreen: () => void;
  onDraftFromTheme: () => void;
  onSendToStoryboard: () => void;
};

export function ScriptWorkbenchPrimaryActions({
  view,
  setView,
  onOpenFullscreen,
  onDraftFromTheme,
  onSendToStoryboard,
}: Props) {
  return (
    <>
      <span className="scriptToolbarTitle">脚本工作台</span>
      <div className="scriptViewToggle" role="group" aria-label="脚本展示模式">
        <button
          type="button"
          className="scriptViewToggleBtn"
          aria-pressed={view === "table"}
          data-active={view === "table" ? "true" : "false"}
          onClick={() => setView("table")}
        >
          表格视图
        </button>
        <button
          type="button"
          className="scriptViewToggleBtn"
          aria-pressed={view === "card"}
          data-active={view === "card" ? "true" : "false"}
          onClick={() => setView("card")}
        >
          卡片视图
        </button>
      </div>
      <button
        type="button"
        className="btn btnPrimary"
        onClick={onOpenFullscreen}
        title="在大窗口中编辑表格（Esc 关闭）"
      >
        全屏表格
      </button>
      <button type="button" className="btn btnPrimary" onClick={onDraftFromTheme}>
        根据主题生成草案
      </button>
      <button
        type="button"
        className="btn btnPrimary"
        onClick={onSendToStoryboard}
        title="同步勾选并滚动到侧栏「分镜」区，在此生成分镜或一键创建图片/视频链路"
      >
        进入分镜区
      </button>
    </>
  );
}
