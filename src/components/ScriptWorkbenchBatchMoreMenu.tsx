type BatchField = "shotSize" | "cameraMove";

type Props = {
  moreOpen: boolean;
  setMoreOpen: (updater: (v: boolean) => boolean) => void;
  sortByShotNumber: () => void;
  rowsLength: number;
  renumberSelectedShotNumbers: () => void;
  padSelectedShotNumbers: () => void;
  selectedIdsLength: number;
  batchFillOpen: boolean;
  setBatchFillOpen: (updater: (v: boolean) => boolean) => void;
  batchField: BatchField;
  setBatchField: (value: BatchField) => void;
  batchValue: string;
  setBatchValue: (value: string) => void;
  applyBatchFill: () => void;
  shotTypeOptions: readonly string[];
  cameraMoveOptions: readonly string[];
  shotTypePresets: readonly string[];
  cameraMovePresets: readonly string[];
  currentFavorites: string[];
  batchFavMax: number;
  removeBatchFavorite: (fav: string) => void;
  addBatchFavorite: () => void;
  clearBatchField: () => void;
};

export function ScriptWorkbenchBatchMoreMenu({
  moreOpen,
  setMoreOpen,
  sortByShotNumber,
  rowsLength,
  renumberSelectedShotNumbers,
  padSelectedShotNumbers,
  selectedIdsLength,
  batchFillOpen,
  setBatchFillOpen,
  batchField,
  setBatchField,
  batchValue,
  setBatchValue,
  applyBatchFill,
  shotTypeOptions,
  cameraMoveOptions,
  shotTypePresets,
  cameraMovePresets,
  currentFavorites,
  batchFavMax,
  removeBatchFavorite,
  addBatchFavorite,
  clearBatchField,
}: Props) {
  return (
    <div className="scriptToolbarMore">
      <button
        type="button"
        className="btn"
        onClick={() => setMoreOpen((v) => !v)}
        aria-expanded={moreOpen}
        title={moreOpen ? "收起更多批量操作" : "展开更多批量操作"}
      >
        更多操作…
      </button>
      {moreOpen ? (
        <div className="scriptToolbarMoreMenu" role="menu" aria-label="更多批量操作">
          <button
            type="button"
            className="btn"
            onClick={sortByShotNumber}
            disabled={rowsLength <= 1}
            title="按镜号从小到大自动排序（如 1, 2, 3, 10）"
          >
            按镜号排序
          </button>
          <button
            type="button"
            className="btn"
            onClick={renumberSelectedShotNumbers}
            disabled={selectedIdsLength === 0}
            title="将已勾选镜头按当前顺序连续重排为 1,2,3…"
          >
            勾选重排镜号
          </button>
          <button
            type="button"
            className="btn"
            onClick={padSelectedShotNumbers}
            disabled={selectedIdsLength === 0}
            title="将勾选项中的数字镜号补零（如 1→001）"
          >
            勾选镜号补零
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setBatchFillOpen((v) => !v)}
            aria-expanded={batchFillOpen}
            title={batchFillOpen ? "收起批量填写" : "展开批量填写"}
          >
            批量填写字段…
          </button>
          {batchFillOpen ? (
            <div className="scriptBatchFillPanel">
              <label>
                字段
                <select
                  value={batchField}
                  onChange={(e) => {
                    const nextField = e.target.value as BatchField;
                    setBatchField(nextField);
                    setBatchValue("");
                  }}
                >
                  <option value="shotSize">景别</option>
                  <option value="cameraMove">运镜</option>
                </select>
              </label>
              <label>
                值
                <input
                  value={batchValue}
                  onChange={(e) => setBatchValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    if (selectedIdsLength === 0 || !batchValue.trim()) return;
                    e.preventDefault();
                    applyBatchFill();
                  }}
                  list={`script-batch-options-${batchField}`}
                  placeholder={batchField === "shotSize" ? "输入或选择景别" : "输入或选择运镜"}
                />
                <datalist id={`script-batch-options-${batchField}`}>
                  {(batchField === "shotSize" ? shotTypeOptions : cameraMoveOptions).map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              </label>
              <div className="scriptBatchPresetRow">
                <span className="scriptBatchPresetLabel">常用预设</span>
                <div className="scriptBatchPresetChips">
                  {(batchField === "shotSize" ? shotTypePresets : cameraMovePresets).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`btn scriptBatchPresetChip${batchValue === preset ? " is-active" : ""}`}
                      onClick={() => setBatchValue(preset)}
                      title={`一键填入：${preset}`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
              <div className="scriptBatchPresetRow">
                <span className="scriptBatchPresetLabel">
                  我的收藏（{currentFavorites.length}/{batchFavMax}）
                </span>
                <div className="scriptBatchPresetChips">
                  {currentFavorites.length === 0 ? (
                    <span className="scriptBatchFavEmpty">暂无，选好「值」后点下方「加入收藏」</span>
                  ) : (
                    currentFavorites.map((fav) => (
                      <span key={fav} className="scriptBatchFavChipWrap">
                        <button
                          type="button"
                          className={`btn scriptBatchPresetChip${batchValue === fav ? " is-active" : ""}`}
                          onClick={() => setBatchValue(fav)}
                          title={`填入：${fav}`}
                        >
                          {fav}
                        </button>
                        <button
                          type="button"
                          className="scriptBatchFavRemove"
                          onClick={() => removeBatchFavorite(fav)}
                          aria-label={`移除收藏 ${fav}`}
                          title="移除收藏"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  className="btn scriptBatchFavAddBtn"
                  onClick={addBatchFavorite}
                  disabled={!batchValue.trim() || currentFavorites.length >= batchFavMax}
                  title="把当前「值」加入本字段收藏（最多 5 条）"
                >
                  加入收藏
                </button>
              </div>
              <button
                type="button"
                className="btn btnPrimary"
                onClick={applyBatchFill}
                disabled={selectedIdsLength === 0 || !batchValue.trim()}
                title="将该字段写入所有勾选镜头"
              >
                应用到勾选项
              </button>
              <button
                type="button"
                className="btn btnDanger"
                onClick={clearBatchField}
                disabled={selectedIdsLength === 0}
                title="清空勾选项中该字段"
              >
                清空该字段
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
