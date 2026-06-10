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
  /** 只读模式：禁用编辑、删除、移动、角色编辑；参考图上传除外 */
  readOnly?: boolean;
  rows: ScriptBeat[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onPersistRows: (next: ScriptBeat[]) => void;
  projectPath?: string | null;
  onStatusText?: (msg: string) => void;
  highlightBeatId?: string | null;
  onHighlightDone?: () => void;
};

/** 脚本镜头表格（只读模式：仅展示 + 勾选 + 参考图上传；编辑/删除/移动全部禁用） */
export function ScriptBeatsEditorTable({
  variant,
  readOnly = false,
  rows,
  selectedIds,
  onToggleSelect,
  onPersistRows,
  projectPath,
  onStatusText,
  highlightBeatId,
  onHighlightDone,
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
  const toolsRef = useRef<HTMLDivElement>(null);
  const inlineRootRef = useRef<HTMLDivElement | null>(null);
  const fieldsInputRef = useRef<HTMLInputElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const fieldRowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [inlineContainerWidth, setInlineContainerWidth] = useState(0);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<{ colKey: string; startX: number; startW: number } | null>(null);

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

  const tableWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!highlightBeatId || variant !== "fullscreen") return;
    const row = tableWrapRef.current?.querySelector<HTMLElement>(
      `tr[data-beat-id="${highlightBeatId}"]`,
    );
    if (!row) return;
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = window.setTimeout(() => onHighlightDone?.(), 2400);
    return () => window.clearTimeout(t);
  }, [highlightBeatId, variant, displayRows, onHighlightDone]);

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
    if (!fieldsOpen && !filterOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (toolsRef.current?.contains(e.target as Node)) return;
      setFieldsOpen(false);
      setFilterOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [fieldsOpen, filterOpen]);

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

  const startResize = useCallback((e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    const thEl = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
    const currentW = thEl.getBoundingClientRect().width;
    resizingRef.current = { colKey, startX: e.clientX, startW: currentW };
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const diff = ev.clientX - resizingRef.current.startX;
      const newW = Math.max(60, resizingRef.current.startW + diff);
      setColWidths((prev) => ({ ...prev, [resizingRef.current!.colKey]: newW }));
    };
    const onUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const resetColWidth = useCallback((colKey: string) => {
    setColWidths((prev) => {
      const next = { ...prev };
      delete next[colKey];
      return next;
    });
  }, []);

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
    if (!fieldsOpen && !filterOpen) return;
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
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [variant, fieldsOpen, filterOpen]);

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

  const cols = visibleCols;
  const colCount = cols.length + 1;
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
    const base = 36 + cols.reduce((sum, c) => sum + getInlineColWidth(c, inlineContainerWidth), 0);
    const containerBase = inlineContainerWidth > 0 ? inlineContainerWidth + 180 : base;
    return Math.max(base, containerBase);
  }, [variant, cols, inlineContainerWidth]);

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
            const w = colWidths[c.key] ?? getInlineColWidth(c, inlineContainerWidth);
            return <col key={`col-${c.key}`} style={{ width: w, minWidth: w, maxWidth: w }} />;
          })}
        </colgroup>
      ) : null}
      <thead>
        <tr>
          <th style={{ width: 36 }} aria-label="勾选" />
          {cols.map((c, colIdx) => (
            <th
              key={c.key}
              style={{
                ...inlineColStyle(c),
                width: colWidths[c.key] ?? inlineColStyle(c)?.width,
                minWidth: 60,
              }}
            >
              {c.label}
              {colIdx < cols.length - 1 && (
                <div
                  className="col-resize-handle"
                  onMouseDown={(e) => startResize(e, c.key)}
                  onDoubleClick={() => resetColWidth(c.key)}
                />
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {normRows.length === 0 ? (
          <tr>
            <td colSpan={colCount} style={{ padding: 24, color: "var(--muted)", textAlign: "center" }}>
              {variant === "fullscreen"
                ? "暂无镜头条目。请在画布脚本节点中 AI 解析生成。"
                : "暂无镜头条目。"}
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
              <tr
                key={b.id}
                data-beat-id={b.id}
                className={highlightBeatId === b.id ? "scriptTableRow--highlight" : ""}
              >
                <td tabIndex={0}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(b.id)}
                    onChange={() => onToggleSelect(b.id)}
                    aria-label={`选择镜头 ${idx + 1}`}
                  />
                </td>
                {cols.map((c) => (
                  <td
                    key={c.key}
                    className={selectedIds.includes(normRows[idx]?.id) ? "cell-selected" : ""}
                  >
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
                      readOnly={readOnly}
                    />
                  </td>
                ))}
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
      />

      <div ref={tableWrapRef} className="scriptTableFullscreenScroll">
        {tableEl}
      </div>
    </div>
  );
}
