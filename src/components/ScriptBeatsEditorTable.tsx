import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ScriptBeat } from "@/lib/types";
import { normalizeScriptBeat } from "@/lib/scriptBeatHelpers";
import {
  DEFAULT_HIDDEN_COLS,
  getInlineColWidth,
  inlineFixedWidthByContainer,
  INLINE_COLUMNS_COMPACT,
  INLINE_COLUMNS_MEDIUM,
  INLINE_COLUMNS_WIDE,
  loadFieldsQueryFromSession,
  loadFilterQueryFromStorage,
  loadHiddenColsFromStorage,
  persistFieldsQueryToSession,
  persistFilterQueryToStorage,
  persistHiddenColsToStorage,
  rowMatchesFilter,
  SCRIPT_BEATS_FULLSCREEN_BASE_COLUMNS,
  type ScriptBeatsTableVariant,
  type TableCol,
} from "@/lib/scriptBeatsTableModel";
import { ScriptBeatsEditorTableToolbar } from "@/components/ScriptBeatsEditorTableToolbar";
import { ScriptBeatsTableCellRenderer } from "@/components/ScriptBeatsTableCellRenderer";

export type { ScriptBeatsTableVariant } from "@/lib/scriptBeatsTableModel";
export { SCRIPT_BEATS_FULLSCREEN_BASE_COLUMNS } from "@/lib/scriptBeatsTableModel";

type Props = {
  variant: ScriptBeatsTableVariant;
  rows: ScriptBeat[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onPersistRows: (next: ScriptBeat[]) => void;
  projectPath?: string | null;
  onStatusText?: (msg: string) => void;
};

/** 脚本镜头表格（侧栏内嵌精简列；全屏为完整 Lib 列 + 字段可见性 + 筛选） */
export function ScriptBeatsEditorTable({
  variant,
  rows,
  selectedIds,
  onToggleSelect,
  onPersistRows,
  projectPath,
  onStatusText,
}: Props) {
  const normRows = rows.map((b) => normalizeScriptBeat(b));
  const descRows = variant === "fullscreen" ? 3 : 2;
  const tableClass =
    variant === "fullscreen" ? "scriptTable scriptTableFullscreen scriptTableLibWide" : "scriptTable";

  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => loadHiddenColsFromStorage());
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [fieldsQuery, setFieldsQuery] = useState(() => loadFieldsQueryFromSession());
  const [activeFieldIndex, setActiveFieldIndex] = useState(0);
  const [jumpFieldKey, setJumpFieldKey] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState(() => loadFilterQueryFromStorage());
  const [roleEditorRowId, setRoleEditorRowId] = useState<string | null>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const inlineRootRef = useRef<HTMLDivElement | null>(null);
  const fieldsInputRef = useRef<HTMLInputElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const fieldRowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [inlineContainerWidth, setInlineContainerWidth] = useState(0);

  const maxRoleCount = useMemo(() => {
    let n = 0;
    for (const b of normRows) {
      const fromRoles = b.characters?.length ?? 0;
      const legacyCount = [b.character1, b.character2].filter((x) => (x ?? "").trim().length > 0).length;
      n = Math.max(n, fromRoles, legacyCount);
    }
    return n;
  }, [normRows]);

  const dynamicRoleCols = useMemo<TableCol[]>(() => {
    const out: TableCol[] = [];
    for (let i = 0; i < maxRoleCount; i += 1) {
      const n = i + 1;
      out.push({ key: `roleName:${i}`, label: `角色${n}`, minW: 88 });
      out.push({ key: `roleDesc:${i}`, label: `角色${n}描述`, minW: 160 });
      out.push({ key: `roleImage:${i}`, label: `角色${n}参考图`, minW: 120 });
    }
    return out;
  }, [maxRoleCount]);

  const fullscreenCols = useMemo<TableCol[]>(() => {
    const out: TableCol[] = [];
    for (const c of SCRIPT_BEATS_FULLSCREEN_BASE_COLUMNS) {
      out.push(c);
      if (c.key === "description") out.push(...dynamicRoleCols);
    }
    return out;
  }, [dynamicRoleCols]);

  useEffect(() => {
    if (variant !== "inline") return;
    const el = inlineRootRef.current;
    if (!el) return;
    const updateWidth = () => {
      setInlineContainerWidth(el.clientWidth || 0);
    };
    updateWidth();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }
    const ro = new ResizeObserver(() => updateWidth());
    ro.observe(el);
    return () => ro.disconnect();
  }, [variant]);

  const inlineCols = useMemo<TableCol[]>(() => {
    if (inlineContainerWidth <= 0) return INLINE_COLUMNS_WIDE;
    if (inlineContainerWidth < 760) return INLINE_COLUMNS_COMPACT;
    if (inlineContainerWidth < 1020) return INLINE_COLUMNS_MEDIUM;
    return INLINE_COLUMNS_WIDE;
  }, [inlineContainerWidth]);

  const visibleCols = useMemo(() => {
    if (variant !== "fullscreen") return inlineCols;
    return fullscreenCols.filter((c) => !hiddenCols.has(c.key));
  }, [variant, inlineCols, hiddenCols, fullscreenCols]);

  const displayRows = useMemo(() => {
    if (variant !== "fullscreen") return normRows;
    return normRows.filter((b) => rowMatchesFilter(b, filterQuery));
  }, [variant, normRows, filterQuery]);

  const fieldOptions = useMemo(() => {
    const q = fieldsQuery.trim().toLowerCase();
    if (!q) return fullscreenCols;
    return fullscreenCols.filter(
      (c) => c.label.toLowerCase().includes(q) || String(c.key).toLowerCase().includes(q),
    );
  }, [fieldsQuery, fullscreenCols]);

  const safeActiveFieldIndex = useMemo(
    () => (fieldOptions.length === 0 ? 0 : Math.min(activeFieldIndex, fieldOptions.length - 1)),
    [fieldOptions, activeFieldIndex],
  );

  useEffect(() => {
    if (!fieldsOpen && !filterOpen && !roleEditorRowId) return;
    const onDoc = (e: MouseEvent) => {
      if (toolsRef.current?.contains(e.target as Node)) return;
      setFieldsOpen(false);
      setFilterOpen(false);
      setRoleEditorRowId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [fieldsOpen, filterOpen, roleEditorRowId]);

  useEffect(() => {
    if (variant !== "fullscreen") return;
    persistHiddenColsToStorage(hiddenCols);
  }, [variant, hiddenCols]);

  useEffect(() => {
    if (variant !== "fullscreen") return;
    persistFilterQueryToStorage(filterQuery);
  }, [variant, filterQuery]);

  useEffect(() => {
    if (variant !== "fullscreen") return;
    persistFieldsQueryToSession(fieldsQuery);
  }, [variant, fieldsQuery]);

  useEffect(() => {
    if (!jumpFieldKey) return;
    const timer = window.setTimeout(() => setJumpFieldKey(null), 900);
    return () => window.clearTimeout(timer);
  }, [jumpFieldKey]);

  useEffect(() => {
    if (!fieldsOpen) return;
    const timer = window.setTimeout(() => fieldsInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [fieldsOpen]);

  useEffect(() => {
    if (!filterOpen) return;
    const timer = window.setTimeout(() => filterInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [filterOpen]);

  useEffect(() => {
    if (variant !== "fullscreen") return;
    if (!fieldsOpen && !filterOpen && !roleEditorRowId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (filterOpen) {
        setFilterQuery("");
        setFilterOpen(false);
        e.preventDefault();
        return;
      }
      if (fieldsOpen) {
        setFieldsOpen(false);
        e.preventDefault();
        return;
      }
      if (roleEditorRowId) {
        setRoleEditorRowId(null);
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [variant, fieldsOpen, filterOpen, roleEditorRowId]);

  const cols = visibleCols;
  const colCount = cols.length + 2;
  const inlineColStyle = (c: TableCol): CSSProperties | undefined => {
    if (variant === "fullscreen") return c.minW ? { minWidth: c.minW } : undefined;
    const fixed = inlineFixedWidthByContainer(c.key, inlineContainerWidth);
    if (fixed) {
      return {
        width: fixed,
        minWidth: fixed,
        maxWidth: fixed,
      };
    }
    return c.minW ? { minWidth: c.minW } : undefined;
  };
  const inlineTableWidth = useMemo(() => {
    if (variant === "fullscreen") return undefined;
    const base = 36 + 56 + cols.reduce((sum, c) => sum + getInlineColWidth(c, inlineContainerWidth), 0);
    const containerBase = inlineContainerWidth > 0 ? inlineContainerWidth + 180 : base;
    return Math.max(base, containerBase);
  }, [variant, cols, inlineContainerWidth]);

  const toggleColHidden = (key: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      const visibleCount = fullscreenCols.length - prev.size;
      if (visibleCount <= 1) {
        onStatusText?.("至少保留 1 列可见");
        return prev;
      }
      next.add(key);
      return next;
    });
  };

  const showAllCols = () => setHiddenCols(new Set<string>());
  const restoreDefaultCols = () => {
    setHiddenCols(new Set<string>(DEFAULT_HIDDEN_COLS));
    onStatusText?.("已恢复默认字段布局");
  };
  const hideAllCols = () => {
    const keep = "shotNumber";
    setHiddenCols(new Set<string>(fullscreenCols.map((c) => c.key).filter((k) => k !== keep)));
    onStatusText?.("已隐藏大部分字段，保留「镜号」列");
  };

  const allSelected = displayRows.length > 0 && displayRows.every((b) => selectedIds.includes(b.id));
  const handleSelectAll = useCallback(() => {
    const selectedIdsSet = new Set(selectedIds);
    if (allSelected) {
      selectedIds.forEach((id) => onToggleSelect(id));
    } else {
      displayRows.forEach((b) => {
        if (!selectedIdsSet.has(b.id)) onToggleSelect(b.id);
      });
    }
  }, [displayRows, selectedIds, onToggleSelect, allSelected]);

  const tableEl = (
    <table
      className={tableClass}
      style={
        variant === "fullscreen"
          ? undefined
          : {
              width: inlineTableWidth,
              minWidth: inlineTableWidth,
              tableLayout: "fixed",
            }
      }
    >
      {variant !== "fullscreen" ? (
        <colgroup>
          <col style={{ width: 36, minWidth: 36, maxWidth: 36 }} />
          {cols.map((c) => {
            const w = getInlineColWidth(c, inlineContainerWidth);
            return <col key={`col-${c.key}`} style={{ width: w, minWidth: w, maxWidth: w }} />;
          })}
          <col style={{ width: 56, minWidth: 56, maxWidth: 56 }} />
        </colgroup>
      ) : null}
      <thead>
        <tr>
          <th style={{ width: 36 }} aria-label="勾选" />
          {cols.map((c) => (
            <th key={c.key} style={inlineColStyle(c)}>
              {c.label}
            </th>
          ))}
          <th style={{ width: 56 }} />
        </tr>
      </thead>
      <tbody>
        {normRows.length === 0 ? (
          <tr>
            <td colSpan={colCount} style={{ padding: 24, color: "var(--muted)", textAlign: "center" }}>
              {variant === "fullscreen"
                ? "暂无镜头条目。请在侧栏「脚本工作台」中生成草案或添加镜头。"
                : "暂无镜头条目。全屏表格可编辑全部列，或在此快速编辑镜号/时长/画面/景别。"}
            </td>
          </tr>
        ) : displayRows.length === 0 ? (
          <tr>
            <td colSpan={colCount} style={{ padding: 24, color: "var(--muted)", textAlign: "center" }}>
              没有符合当前筛选条件的镜头，请修改筛选关键词。
            </td>
          </tr>
        ) : (
          displayRows.map((b) => {
            const origIdx = normRows.findIndex((r) => r.id === b.id);
            const idx = origIdx >= 0 ? origIdx : 0;
            return (
              <tr key={b.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(b.id)}
                    onChange={() => onToggleSelect(b.id)}
                    aria-label={`选择镜头 ${idx + 1}`}
                  />
                </td>
                {cols.map((c) => (
                  <td key={c.key}>
                    <ScriptBeatsTableCellRenderer
                      beat={b}
                      rowIndex={idx}
                      colKey={c.key}
                      variant={variant}
                      descRows={descRows}
                      normRows={normRows}
                      projectPath={projectPath}
                      onStatusText={onStatusText}
                      onPersistRows={onPersistRows}
                      roleEditorRowId={roleEditorRowId}
                      setRoleEditorRowId={setRoleEditorRowId}
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="btn btnDanger"
                    style={{ padding: "4px 8px" }}
                    onClick={() => onPersistRows(normRows.filter((r) => r.id !== b.id))}
                  >
                    删
                  </button>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );

  if (variant !== "fullscreen") {
    return (
      <div
        ref={inlineRootRef}
        className={`scriptTableInlineRoot ${
          inlineContainerWidth < 760 ? "scriptTableInlineRoot--compact" : inlineContainerWidth < 1020 ? "scriptTableInlineRoot--medium" : ""
        }`}
      >
        {tableEl}
      </div>
    );
  }

  return (
    <div className="scriptTableFullscreenRoot">
      <ScriptBeatsEditorTableToolbar
        toolsRef={toolsRef}
        fieldsInputRef={fieldsInputRef}
        filterInputRef={filterInputRef}
        fieldRowRefs={fieldRowRefs}
        fieldsOpen={fieldsOpen}
        filterOpen={filterOpen}
        setFieldsOpen={setFieldsOpen}
        setFilterOpen={setFilterOpen}
        cols={cols}
        fullscreenCols={fullscreenCols}
        fieldOptions={fieldOptions}
        hiddenCols={hiddenCols}
        fieldsQuery={fieldsQuery}
        setFieldsQuery={setFieldsQuery}
        safeActiveFieldIndex={safeActiveFieldIndex}
        setActiveFieldIndex={setActiveFieldIndex}
        jumpFieldKey={jumpFieldKey}
        setJumpFieldKey={setJumpFieldKey}
        toggleColHidden={toggleColHidden}
        showAllCols={showAllCols}
        restoreDefaultCols={restoreDefaultCols}
        hideAllCols={hideAllCols}
        filterQuery={filterQuery}
        setFilterQuery={setFilterQuery}
        displayRowsLength={displayRows.length}
        normRowsLength={normRows.length}
        selectedCount={selectedIds.length}
        onDelete={() => {
          const selectedIdsSet = new Set(selectedIds);
          const kept = normRows.filter((r) => !selectedIdsSet.has(r.id));
          onPersistRows(kept);
        }}
        onSelectAll={handleSelectAll}
      />

      <div className="scriptTableFullscreenScroll">{tableEl}</div>
    </div>
  );
}
