type Props = {
  dangerOpen: boolean;
  setDangerOpen: (updater: (v: boolean) => boolean) => void;
  deleteSelectedRows: () => void;
  keepSelectedOnly: () => void;
  undoLastBatchOperation: () => void;
  hasBatchUndo: boolean;
  selectedIdsLength: number;
  rowsLength: number;
  batchLogOpen: boolean;
  setBatchLogOpen: (updater: (v: boolean) => boolean) => void;
  recentBatchLogsLength: number;
};

export function ScriptWorkbenchDangerBar({
  dangerOpen,
  setDangerOpen,
  deleteSelectedRows,
  keepSelectedOnly,
  undoLastBatchOperation,
  hasBatchUndo,
  selectedIdsLength,
  rowsLength,
  batchLogOpen,
  setBatchLogOpen,
  recentBatchLogsLength,
}: Props) {
  return (
    <>
      <div className="scriptToolbarDangerGroup" role="group" aria-label="危险操作">
        <button
          type="button"
          className={`btn btnDanger scriptToolbarDangerToggle${dangerOpen ? " is-open" : ""}`}
          onClick={() => setDangerOpen((v) => !v)}
          aria-expanded={dangerOpen}
          title={dangerOpen ? "收起危险操作" : "展开危险操作"}
        >
          危险操作…
        </button>
        {dangerOpen ? (
          <div className="scriptToolbarDangerActions">
            <button
              type="button"
              className="btn btnDanger"
              onClick={deleteSelectedRows}
              disabled={rowsLength === 0 || selectedIdsLength === 0}
              title="删除已勾选条目"
            >
              删除勾选
            </button>
            <button
              type="button"
              className="btn btnDanger"
              onClick={keepSelectedOnly}
              disabled={rowsLength === 0 || selectedIdsLength === 0}
              title="删除未勾选条目，仅保留已勾选内容"
            >
              仅保留勾选
            </button>
            <button
              type="button"
              className="btn btnDanger"
              onClick={undoLastBatchOperation}
              disabled={!hasBatchUndo}
              title="撤销最近一次镜号批量操作（排序/重排/补零/仅保留）"
            >
              撤销批量镜号操作
            </button>
          </div>
        ) : null}
      </div>
      <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
        已勾选 {selectedIdsLength}/{rowsLength}
      </span>
      <button
        type="button"
        className="btn"
        onClick={() => setBatchLogOpen((v) => !v)}
        aria-expanded={batchLogOpen}
        disabled={recentBatchLogsLength === 0}
        title={recentBatchLogsLength > 0 ? "展开最近批量操作记录" : "暂无批量操作记录"}
      >
        最近批量操作
      </button>
    </>
  );
}
