# ScriptBeatsEditorTable Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 UX enhancements to ScriptBeatsEditorTable: batch delete, row move, column resize, and quick editing (double-click/Tab/Enter/Ctrl+A).

**Architecture:** All state managed in ScriptBeatsEditorTable.tsx via useState (colWidths, selectedIndices, editingCell, isAllSelected). Toolbar gains delete button and move-to dropdown. Keyboard handler added via useEffect on document. Column resize via global onMouseMove/onMouseUp on document. No external dependencies.

**Tech Stack:** React hooks (useState, useEffect, useCallback, useMemo, useRef), CSS drag handles, document-level mouse events.

---

## Task 1: Add selectedIndices state and batch delete toolbar button

**Files:**
- Modify: `src/components/ScriptBeatsEditorTable.tsx` — add selectedIndices state, delete button in toolbar
- Modify: `src/components/ScriptBeatsEditorTable.css` — add toolbar delete button styles

- [ ] **Step 1: Add selectedIndices state**

In ScriptBeatsEditorTable.tsx, add state:
```typescript
const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
```

- [ ] **Step 2: Add select all / deselect all helper**

```typescript
const allSelected = displayRows.length > 0 && selectedIndices.size === displayRows.length;
const handleSelectAll = useCallback(() => {
  if (allSelected) {
    setSelectedIndices(new Set());
  } else {
    setSelectedIndices(new Set(displayRows.map((_, i) => i)));
  }
}, [displayRows, allSelected]);
```

- [ ] **Step 3: Pass selectedIndices and handlers to toolbar**

ScriptBeatsEditorTableToolbar already receives a toolsRef, filterOpen, fieldsOpen etc. We need to add a `selectedCount` prop and an `onDelete` callback:

```typescript
// In ScriptBeatsEditorTable.tsx, in the toolbar props:
<ScriptBeatsEditorTableToolbar
  ...
  selectedCount={selectedIndices.size}
  onDelete={() => {
    const kept = normRows.filter((_, i) => !selectedIndices.has(i));
    onPersistRows(kept);
    setSelectedIndices(new Set());
  }}
  onSelectAll={handleSelectAll}
/>
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: No errors related to selectedCount/onDelete

- [ ] **Step 5: Add CSS for delete button in toolbar**

In ScriptBeatsEditorTable.css, add:
```css
/* Toolbar delete button appears when rows selected */
.toolbar-delete-btn {
  background: #dc2626;
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.toolbar-delete-btn:hover {
  background: #b91c1c;
}
```

---

## Task 2: Single-row delete via Delete key (no checkbox required)

**Files:**
- Modify: `src/components/ScriptBeatsEditorTable.tsx` — add document-level keydown handler

- [ ] **Step 1: Add a focusedRowIndex ref and focus management**

```typescript
const focusedRowIndexRef = useRef<number | null>(null);
```

- [ ] **Step 2: Add document-level keydown handler for Delete**

```typescript
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    // Don't fire if user is typing in an input/textarea (outside table)
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

    if (focusedRowIndexRef.current !== null) {
      e.preventDefault();
      const idx = focusedRowIndexRef.current;
      const newRows = normRows.filter((_, i) => i !== idx);
      onPersistRows(newRows);
      // Move focus to next row (or previous if deleted last row)
      const nextIdx = Math.min(idx, newRows.length - 1);
      focusedRowIndexRef.current = nextIdx >= 0 ? nextIdx : null;
    }
  };
  document.addEventListener("keydown", onKey);
  return () => document.removeEventListener("keydown", onKey);
}, [normRows, onPersistRows]);
```

- [ ] **Step 3: Track focused row on cell focus**

In the `<td>` cell render, add onFocus that sets `focusedRowIndexRef.current = idx`. Each ScriptBeatsTableCellRenderer will need a tabIndex prop. Add to the `<td>` wrapper:

```typescript
<td
  tabIndex={0}
  onFocus={() => { focusedRowIndexRef.current = idx; }}
>
```

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/ScriptBeatsEditorTable.tsx src/components/ScriptBeatsEditorTable.css
git commit -m "feat(table): add batch delete toolbar and single-row Delete key"
```

---

## Task 3: Row move — Shift+Arrow and toolbar move-to dropdown

**Files:**
- Modify: `src/components/ScriptBeatsEditorTable.tsx` — add move logic and Shift+Arrow handler
- Modify: `src/components/ScriptBeatsEditorTableToolbar.tsx` — add move-to dropdown

- [ ] **Step 1: Add moveRow function**

```typescript
const moveRows = useCallback(
  (direction: "up" | "down" | "top" | "bottom", indices?: Set<number>) => {
    const toMove = indices ?? selectedIndices;
    if (toMove.size === 0) return;
    const sorted = [...toMove].sort((a, b) => a - b);
    const selected = sorted.map((i) => normRows[i]);
    const remaining = normRows.filter((_, i) => !toMove.has(i));

    let reordered: ScriptBeat[];
    if (direction === "top") {
      reordered = [...selected, ...remaining];
    } else if (direction === "bottom") {
      reordered = [...remaining, ...selected];
    } else if (direction === "up") {
      // Move each selected row one position up, adjusting for shifts
      const targetMap = new Map<number, number>();
      let offset = 0;
      for (const idx of sorted) {
        const newIdx = idx - offset - 1;
        if (newIdx >= 0) {
          targetMap.set(idx, newIdx);
        } else {
          offset++;
        }
      }
      reordered = [...normRows];
      for (const [origIdx, newIdx] of targetMap) {
        const [item] = reordered.splice(origIdx, 1);
        reordered.splice(newIdx, 0, item);
      }
      // Re-normalize selected after each insertion
      const moved = reordered.filter((r) => selected.some((s) => s.id === r.id));
      reordered = [...moved, ...reordered.filter((r) => !selected.some((s) => s.id === r.id))];
    } else {
      // down — similar approach
      reordered = normRows;
    }

    // Simplified: rebuild from scratch using sorted approach
    const allRows = [...normRows];
    const moving = sorted.map((i) => allRows[i]);
    const staying = allRows.filter((_, i) => !toMove.has(i));

    if (direction === "up") {
      let insertAt = sorted[0] - 1;
      insertAt = Math.max(0, insertAt);
      staying.splice(insertAt, 0, ...moving);
      reordered = staying;
    } else if (direction === "down") {
      let insertAt = sorted[sorted.length - 1] + 1;
      insertAt = Math.min(staying.length, insertAt);
      staying.splice(insertAt, 0, ...moving);
      reordered = staying;
    } else if (direction === "top") {
      reordered = [...moving, ...staying];
    } else {
      reordered = [...staying, ...moving];
    }

    onPersistRows(reordered);
  },
  [normRows, selectedIndices, onPersistRows]
);
```

Actually, a cleaner reindex approach:

```typescript
const moveRows = useCallback(
  (direction: "up" | "down" | "top" | "bottom") => {
    if (selectedIndices.size === 0) return;
    const sorted = [...selectedIndices].sort((a, b) => a - b);
    let reordered = [...normRows];

    if (direction === "up") {
      if (sorted[0] === 0) return; // already at top
      for (const idx of sorted) {
        [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
      }
    } else if (direction === "down") {
      if (sorted[sorted.length - 1] === normRows.length - 1) return; // already at bottom
      for (let i = sorted.length - 1; i >= 0; i--) {
        const idx = sorted[i];
        [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
      }
    } else if (direction === "top") {
      const moving = sorted.map((i) => reordered[i]);
      reordered = reordered.filter((_, i) => !selectedIndices.has(i));
      reordered.unshift(...moving);
    } else {
      const moving = sorted.map((i) => reordered[i]);
      reordered = reordered.filter((_, i) => !selectedIndices.has(i));
      reordered.push(...moving);
    }

    onPersistRows(reordered);
  },
  [normRows, selectedIndices, onPersistRows]
);
```

- [ ] **Step 2: Add Shift+Arrow keyboard handler**

In the same useEffect for keydown:

```typescript
if (e.key === "ArrowUp" && e.shiftKey) {
  e.preventDefault();
  moveRows("up");
} else if (e.key === "ArrowDown" && e.shiftKey) {
  e.preventDefault();
  moveRows("down");
}
```

- [ ] **Step 3: Pass moveRows to toolbar**

In ScriptBeatsEditorTableToolbar props:
```typescript
onMove={moveRows}
```

- [ ] **Step 4: Add move-to dropdown in toolbar**

In ScriptBeatsEditorTableToolbar.tsx, render conditionally when selectedCount > 0:

```tsx
{selectedCount > 0 && (
  <select
    className="move-to-select"
    defaultValue=""
    onChange={(e) => {
      if (e.target.value) {
        onMove(e.target.value as "up" | "down" | "top" | "bottom");
        e.target.value = "";
      }
    }}
  >
    <option value="" disabled>移动到</option>
    <option value="up">↑ 上移一层</option>
    <option value="down">↓ 下移一层</option>
    <option value="top">⤒ 置顶</option>
    <option value="bottom">⤓ 置底</option>
  </select>
)}
```

And styles in ScriptBeatsEditorTable.css:
```css
.move-to-select {
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #ccc;
  font-size: 13px;
  cursor: pointer;
}
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/ScriptBeatsEditorTable.tsx src/components/ScriptBeatsEditorTableToolbar.tsx src/components/ScriptBeatsEditorTable.css
git commit -m "feat(table): add row move with Shift+Arrow and toolbar dropdown"
```

---

## Task 4: Column width drag resize

**Files:**
- Modify: `src/components/ScriptBeatsEditorTable.tsx` — colWidths state, resize handlers, th resize handle divs
- Modify: `src/components/ScriptBeatsEditorTable.css` — .col-resize-handle styles

- [ ] **Step 1: Add colWidths state**

```typescript
const [colWidths, setColWidths] = useState<Record<string, number>>({});
```

- [ ] **Step 2: Add resize handler functions**

```typescript
const resizingRef = useRef<{ colKey: string; startX: number; startW: number } | null>(null);

const startResize = useCallback((e: React.MouseEvent, colKey: string) => {
  e.preventDefault();
  const currentW = colWidths[colKey] ?? 0;
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
}, [colWidths]);

const resetColWidth = useCallback((colKey: string) => {
  setColWidths((prev) => {
    const next = { ...prev };
    delete next[colKey];
    return next;
  });
}, []);
```

- [ ] **Step 3: Add resize handle divs to th elements**

In the `<thead>` section, modify each `<th>` (non-last-col) to include a resize handle:

```tsx
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
```

Also add resize handle for the last header cell if there are action columns. Actually, the spec says "除最后一列外" (except last column). The last th is the action column (delete button), so we exclude it.

- [ ] **Step 4: Add CSS for resize handles**

In ScriptBeatsEditorTable.css:
```css
.col-resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  width: 6px;
  cursor: col-resize;
  user-select: none;
}
th {
  position: relative;
  overflow: hidden;
}
```

Also update th to have `position: relative` in the table styles.

- [ ] **Step 5: Apply colWidths to table colgroup and cells**

In the `<col>` elements and `<td>` elements, use colWidths:
```tsx
<col style={{ width: colWidths[c.key] ?? w, minWidth: colWidths[c.key] ?? w, maxWidth: colWidths[c.key] ?? w }} />
```

And in cell `<td>`:
```tsx
<td style={{ width: colWidths[c.key], minWidth: 60 }}>
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/ScriptBeatsEditorTable.tsx src/components/ScriptBeatsEditorTable.css
git commit -m "feat(table): add column resize via drag handle"
```

---

## Task 5: Quick edit — double-click, Tab navigation, Enter to confirm+next row, Ctrl+A

**Files:**
- Modify: `src/components/ScriptBeatsEditorTable.tsx` — editingCell state, isEditing state, keyboard handlers, cell rendering logic

- [ ] **Step 1: Add editing states**

```typescript
const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
const [editValue, setEditValue] = useState("");
const [isAllSelected, setIsAllSelected] = useState(false);
```

- [ ] **Step 2: Add cell click/double-click handlers**

For each `<td>` in the table body, determine if it's the editing cell:

```tsx
{cols.map((c) => {
  const isEditing = editingCell?.row === idx && editingCell?.col === c.key;
  return (
    <td
      key={c.key}
      className={isEditing ? "cell-editing" : selectedIndices.has(idx) ? "cell-selected" : ""}
      onClick={() => {
        if (!isEditing) {
          setEditingCell(null);
          setIsAllSelected(false);
        }
      }}
      onDoubleClick={() => {
        const beat = normRows[idx];
        const val = beat[c.key as keyof ScriptBeat] as string ?? "";
        setEditingCell({ row: idx, col: c.key });
        setEditValue(val);
        setIsAllSelected(false);
      }}
    >
      {isEditing ? (
        <textarea
          className="cell-editor"
          value={editValue}
          autoFocus
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              // Save and move to next row
              onPersistRows(
                normRows.map((b, i) =>
                  i === idx ? { ...b, [c.key]: editValue } : b
                )
              );
              // Jump to next row same col, or add new row
              if (idx < normRows.length - 1) {
                setEditingCell({ row: idx + 1, col: c.key });
                setEditValue((normRows[idx + 1][c.key as keyof ScriptBeat] as string) ?? "");
              } else {
                // Add new row
                const newRow = normalizeScriptBeat({});
                onPersistRows([...normRows, newRow]);
                setEditingCell({ row: normRows.length, col: c.key });
                setEditValue("");
              }
            } else if (e.key === "Tab") {
              e.preventDefault();
              // Save current
              onPersistRows(
                normRows.map((b, i) =>
                  i === idx ? { ...b, [c.key]: editValue } : b
                )
              );
              // Move to next col same row (or first col next row)
              const colIdx = cols.findIndex((col) => col.key === c.key);
              if (e.shiftKey) {
                if (colIdx > 0) {
                  setEditingCell({ row: idx, col: cols[colIdx - 1].key });
                  setEditValue((normRows[idx][cols[colIdx - 1].key as keyof ScriptBeat] as string) ?? "");
                }
              } else {
                if (colIdx < cols.length - 1) {
                  setEditingCell({ row: idx, col: cols[colIdx + 1].key });
                  setEditValue((normRows[idx][cols[colIdx + 1].key as keyof ScriptBeat] as string) ?? "");
                }
              }
            } else if (e.key === "Escape") {
              setEditingCell(null);
            }
          }}
        />
      ) : (
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
      )}
    </td>
  );
})}
```

- [ ] **Step 3: Add Ctrl+A handler for select-all**

In the document keydown handler (from Task 2), add:

```typescript
if (e.key === "a" && (e.ctrlKey || e.metaKey) && !editingCell) {
  e.preventDefault();
  if (isAllSelected) {
    setIsAllSelected(false);
    setSelectedIndices(new Set());
  } else {
    setIsAllSelected(true);
    setSelectedIndices(new Set(displayRows.map((_, i) => i)));
  }
}
```

- [ ] **Step 4: Escape key deselects all**

In the same handler:
```typescript
if (e.key === "Escape") {
  setIsAllSelected(false);
  setSelectedIndices(new Set());
  if (editingCell) setEditingCell(null);
}
```

- [ ] **Step 5: Click on row (outside cells) deselects**

Add a click handler on the `<tr>` element:
```tsx
<tr
  onClick={(e) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest("td") === null) {
      setIsAllSelected(false);
    }
  }}
>
```

- [ ] **Step 6: Add CSS for selected/editing states**

In ScriptBeatsEditorTable.css:
```css
.cell-selected,
tr.selected-row td {
  background: rgba(59, 130, 246, 0.1);
}
.cell-editing {
  padding: 2px;
}
.cell-editor {
  width: 100%;
  height: 100%;
  min-height: 40px;
  border: 2px solid #3b82f6;
  border-radius: 2px;
  padding: 4px 6px;
  font-size: inherit;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
  background: white;
}
.cell-editor:focus {
  outline: none;
}
tr.all-selected td {
  background: rgba(59, 130, 246, 0.15);
}
```

Also update selected row styling with `.all-selected` class:
```tsx
<tr
  className={isAllSelected ? "all-selected" : ""}
  ...
>
```

- [ ] **Step 7: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (may need minor type adjustments)

- [ ] **Step 8: Commit**

```bash
git add src/components/ScriptBeatsEditorTable.tsx src/components/ScriptBeatsEditorTable.css
git commit -m "feat(table): add quick edit with double-click, Tab/Enter navigation, Ctrl+A"
```

---

## Task 6: Integrate all keyboard shortcuts into single handler

**Files:**
- Modify: `src/components/ScriptBeatsEditorTable.tsx` — consolidate all keyboard handlers

- [ ] **Step 1: Merge all keydown logic into a single useEffect**

Consolidate the Delete, Shift+Arrow, Tab, and Ctrl+A handlers into one useEffect for cleanliness. The existing handlers from Tasks 2, 3, and 5 should be merged.

```typescript
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    const isEditable = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable;
    const isInCellEditor = (e.target as HTMLElement).closest(".cell-editor");

    // Ctrl+A — select all (only when not editing)
    if ((e.ctrlKey || e.metaKey) && e.key === "a" && !editingCell && !isInCellEditor) {
      e.preventDefault();
      if (isAllSelected) {
        setIsAllSelected(false);
        setSelectedIndices(new Set());
      } else {
        setIsAllSelected(true);
        setSelectedIndices(new Set(displayRows.map((_, i) => i)));
      }
      return;
    }

    // Escape — cancel editing/selection
    if (e.key === "Escape") {
      setIsAllSelected(false);
      setSelectedIndices(new Set());
      if (editingCell) setEditingCell(null);
      return;
    }

    // Don't process row ops if user is typing in a form field (except cell editor)
    if (isEditable && !isInCellEditor) return;

    // Delete — single row delete
    if ((e.key === "Delete" || e.key === "Backspace") && !editingCell) {
      e.preventDefault();
      if (focusedRowIndexRef.current !== null) {
        const idx = focusedRowIndexRef.current;
        const newRows = normRows.filter((_, i) => i !== idx);
        onPersistRows(newRows);
        const nextIdx = Math.min(idx, newRows.length - 1);
        focusedRowIndexRef.current = nextIdx >= 0 ? nextIdx : null;
      }
      return;
    }

    // Shift+Arrow — move rows
    if (e.shiftKey && e.key === "ArrowUp" && selectedIndices.size > 0) {
      e.preventDefault();
      moveRows("up");
      return;
    }
    if (e.shiftKey && e.key === "ArrowDown" && selectedIndices.size > 0) {
      e.preventDefault();
      moveRows("down");
      return;
    }
  };
  document.addEventListener("keydown", onKey);
  return () => document.removeEventListener("keydown", onKey);
}, [normRows, selectedIndices, onPersistRows, editingCell, isAllSelected, displayRows, moveRows]);
```

- [ ] **Step 2: Run typecheck and tests**

Run: `npm run typecheck`
Run: `npm run test -- --run`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ScriptBeatsEditorTable.tsx
git commit -m "refactor(table): consolidate keyboard handlers into single useEffect"
```

---

## Task 7: Manual acceptance test verification

Before marking complete, verify all 12 acceptance steps from the spec:

- [ ] Step 1: Select rows via checkbox → toolbar shows 🗑️ Delete(N)
- [ ] Step 2: Cursor on a row → press Delete → row deleted without checkbox
- [ ] Step 3: Cursor on a row → Shift+↑/↓ → row moves up/down
- [ ] Step 4: Multi-select rows → Shift+↑/↓ → all selected rows move together
- [ ] Step 5: Hover column separator → cursor is col-resize → drag changes width
- [ ] Step 6: Double-click cell → input appears → type → Enter → jump to next row
- [ ] Step 7: In edit mode, Tab → jump to next column, content saved
- [ ] Step 8: Press Ctrl+A → all rows highlighted
- [ ] Step 9: In cell editor, Ctrl+A → only text selected (not rows)
- [ ] Step 10: Refresh → column widths reset (not persisted)
- [ ] Step 11: Delete last row → focus moves to previous row
- [ ] Step 12: Toolbar "move to" dropdown → all 4 options work

---

## Spec Coverage Check

| Spec Section | Task |
|------|--------|
| 2. Batch delete (checkbox + Delete key) | Task 1, 2 |
| 3. Row move (Shift+Arrow + toolbar dropdown) | Task 3 |
| 4. Column resize (drag handle + double-click reset) | Task 4 |
| 5. Quick edit (double-click, Tab, Enter, Ctrl+A) | Task 5, 6 |

All 4 features covered. No gaps.