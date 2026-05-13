import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import { ColsIcon, EyeIcon, FilterIcon } from "@/components/ScriptBeatsEditorTableIcons";
import type { TableCol } from "@/lib/scriptBeatsTableModel";

type Props = {
  toolsRef: RefObject<HTMLDivElement>;
  fieldsInputRef: RefObject<HTMLInputElement>;
  filterInputRef: RefObject<HTMLInputElement>;
  fieldRowRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  fieldsOpen: boolean;
  filterOpen: boolean;
  setFieldsOpen: Dispatch<SetStateAction<boolean>>;
  setFilterOpen: Dispatch<SetStateAction<boolean>>;
  cols: TableCol[];
  fullscreenCols: TableCol[];
  fieldOptions: TableCol[];
  hiddenCols: Set<string>;
  fieldsQuery: string;
  setFieldsQuery: Dispatch<SetStateAction<string>>;
  safeActiveFieldIndex: number;
  setActiveFieldIndex: Dispatch<SetStateAction<number>>;
  jumpFieldKey: string | null;
  setJumpFieldKey: Dispatch<SetStateAction<string | null>>;
  toggleColHidden: (key: string) => void;
  showAllCols: () => void;
  restoreDefaultCols: () => void;
  hideAllCols: () => void;
  filterQuery: string;
  setFilterQuery: Dispatch<SetStateAction<string>>;
  displayRowsLength: number;
  normRowsLength: number;
  selectedCount: number;
  onDelete: () => void;
  onSelectAll: () => void;
  onMove: (direction: "up" | "down" | "top" | "bottom") => void;
};

export function ScriptBeatsEditorTableToolbar({
  toolsRef,
  fieldsInputRef,
  filterInputRef,
  fieldRowRefs,
  fieldsOpen,
  filterOpen,
  setFieldsOpen,
  setFilterOpen,
  cols,
  fullscreenCols,
  fieldOptions,
  hiddenCols,
  fieldsQuery,
  setFieldsQuery,
  safeActiveFieldIndex,
  setActiveFieldIndex,
  jumpFieldKey,
  setJumpFieldKey,
  toggleColHidden,
  showAllCols,
  restoreDefaultCols,
  hideAllCols,
  filterQuery,
  setFilterQuery,
  displayRowsLength,
  normRowsLength,
  selectedCount,
  onDelete,
  onSelectAll,
  onMove,
}: Props) {
  return (
    <div className="scriptTableFullscreenToolbar" ref={toolsRef}>
      <div className="scriptTableFullscreenToolbarBtns">
        <button
          type="button"
          className={`scriptTableToolBtn${fieldsOpen ? " scriptTableToolBtn--active" : ""}`}
          onClick={() => {
            setFieldsOpen((o) => !o);
            setFilterOpen(false);
          }}
          aria-expanded={fieldsOpen}
          aria-controls="script-field-visibility"
          title="字段可见性"
        >
          <ColsIcon />
          字段
        </button>
        <button
          type="button"
          className={`scriptTableToolBtn${filterOpen ? " scriptTableToolBtn--active" : ""}`}
          onClick={() => {
            setFilterOpen((o) => !o);
            setFieldsOpen(false);
          }}
          aria-expanded={filterOpen}
          aria-controls="script-row-filter"
          title="筛选镜头行"
        >
          <FilterIcon />
          筛选
        </button>
        {selectedCount > 0 ? (
          <>
            <button
              type="button"
              className="toolbar-delete-btn"
              onClick={onDelete}
              title="删除选中行"
            >
              🗑️ 删除({selectedCount})
            </button>
            <button
              type="button"
              className="scriptTableToolBtn"
              onClick={onSelectAll}
              title="全选 / 取消全选"
            >
              全选
            </button>
            <select
              className="move-to-select"
              defaultValue=""
              onChange={(e) => {
                const val = e.target.value as "up" | "down" | "top" | "bottom";
                if (val) {
                  onMove(val);
                  e.currentTarget.value = "";
                }
              }}
            >
              <option value="" disabled>移动到</option>
              <option value="up">↑ 上移一层</option>
              <option value="down">↓ 下移一层</option>
              <option value="top">⤒ 置顶</option>
              <option value="bottom">⤓ 置底</option>
            </select>
          </>
        ) : null}
      </div>

      {fieldsOpen ? (
        <div
          id="script-field-visibility"
          className="scriptFieldPopover"
          role="dialog"
          aria-label="字段可见性"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="scriptFieldPopoverHead">
            <span className="scriptFieldPopoverTitle">字段可见性</span>
            <div className="scriptFieldPopoverQuick">
              <button type="button" className="scriptFieldPopoverLink" onClick={showAllCols}>
                全部显示
              </button>
              <button type="button" className="scriptFieldPopoverLink" onClick={restoreDefaultCols}>
                恢复默认
              </button>
              <button type="button" className="scriptFieldPopoverLink" onClick={hideAllCols}>
                全部隐藏
              </button>
            </div>
          </div>
          <div className="scriptFieldPopoverMeta">
            已显示 {cols.length} / {fullscreenCols.length} 列
          </div>
          <div className="scriptFieldPopoverSearchWrap">
            <input
              ref={fieldsInputRef}
              type="search"
              className="scriptFieldPopoverSearch mono"
              placeholder="搜索字段名…"
              value={fieldsQuery}
              onChange={(e) => setFieldsQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  if (fieldOptions.length === 0) return;
                  e.preventDefault();
                  const step = e.shiftKey ? -1 : 1;
                  setActiveFieldIndex((prev) => (prev + step + fieldOptions.length) % fieldOptions.length);
                  return;
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  if (fieldOptions.length === 0) return;
                  setActiveFieldIndex((prev) => (prev + 1) % fieldOptions.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  if (fieldOptions.length === 0) return;
                  setActiveFieldIndex((prev) => (prev - 1 + fieldOptions.length) % fieldOptions.length);
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  const current = fieldOptions[safeActiveFieldIndex] ?? fieldOptions[0];
                  if (!current) return;
                  setJumpFieldKey(current.key);
                  fieldRowRefs.current[String(current.key)]?.scrollIntoView({
                    block: "nearest",
                    behavior: "smooth",
                  });
                  toggleColHidden(current.key);
                  return;
                }
                if (e.key !== "Escape") return;
                e.stopPropagation();
                if (fieldsQuery.trim()) {
                  e.preventDefault();
                  setFieldsQuery("");
                }
              }}
              autoComplete="off"
            />
            <div className="scriptFieldPopoverSearchMeta">
              匹配 {fieldOptions.length} 项 / 总计 {fullscreenCols.length} 项
            </div>
          </div>
          <div className="scriptFieldPopoverList" role="list">
            {fieldOptions.map((c) => {
              const visible = !hiddenCols.has(c.key);
              const lockVisible = visible && cols.length <= 1;
              const isActive = fieldOptions[safeActiveFieldIndex]?.key === c.key;
              return (
                <button
                  key={c.key}
                  ref={(el) => {
                    fieldRowRefs.current[String(c.key)] = el;
                  }}
                  type="button"
                  className={`scriptFieldPopoverRow${visible ? "" : " scriptFieldPopoverRow--hidden"}${jumpFieldKey === c.key ? " scriptFieldPopoverRow--jump" : ""}${isActive ? " scriptFieldPopoverRow--active" : ""}`}
                  role="listitem"
                  disabled={lockVisible}
                  onClick={() => toggleColHidden(c.key)}
                  title={lockVisible ? "至少保留 1 列可见" : undefined}
                >
                  <span className="scriptFieldPopoverEye" aria-hidden>
                    <EyeIcon visible={visible} />
                  </span>
                  <span>{c.label}</span>
                </button>
              );
            })}
            {fieldOptions.length === 0 ? <div className="scriptFieldPopoverEmpty">未找到匹配字段</div> : null}
          </div>
          <div className="scriptFieldPopoverHelp">键盘：Tab/Shift+Tab 或 ↑↓ 切换，Enter 切换显隐，Esc 清空搜索</div>
        </div>
      ) : null}

      {filterOpen ? (
        <div
          id="script-row-filter"
          className="scriptFilterPopover"
          role="dialog"
          aria-label="筛选"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="scriptFilterPopoverTitle">筛选镜头</div>
          <input
            ref={filterInputRef}
            type="search"
            className="scriptFilterPopoverInput mono"
            placeholder="在各列文本中搜索…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              e.preventDefault();
              setFilterQuery("");
              setFilterOpen(false);
            }}
            autoComplete="off"
          />
          <div className="scriptFilterPopoverActions">
            <button
              type="button"
              className="scriptFieldPopoverLink"
              onClick={() => setFilterQuery("")}
              disabled={!filterQuery.trim()}
              title="清空筛选关键词"
            >
              清空
            </button>
          </div>
          <div className="scriptFilterPopoverMeta">
            {filterQuery.trim() ? `显示 ${displayRowsLength} / ${normRowsLength} 条` : `共 ${normRowsLength} 条`}
          </div>
        </div>
      ) : null}
    </div>
  );
}
