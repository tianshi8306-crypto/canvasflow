# ScriptBeatsEditorTable Enhancement Design

**Date:** 2026-05-12
**Feature:** ScriptBeatsEditorTable 增强 — 批量删除、行列移动、列宽拖拽、快捷编辑

---

## 1. Concept & Vision

对现有的 `ScriptBeatsEditorTable` 进行四项 UX 增强，使其从一个功能性表格升级为一个真正高效的脚本编辑工具。增强聚焦于"快速操作"和"编辑手感"，不改变数据结构，不破坏现有功能。

---

## 2. Feature 1: 批量删除

### 交互

- 每行左侧 Checkbox 已存在，多选后工具栏出现红色"删除"按钮，显示 `🗑️ 删除(N)`
- 点击直接删除，不弹确认框
- `Delete` / `Backspace` 快捷键直接删除**选中行**

### 单行快捷删除（无 Checkbox 操作）

单行时光标在某行，直接按 `Delete` 直接删除该行（和 Excel 行为一致），不需要先点 Checkbox。

### 焦点管理

- 删除后自动聚焦到**下一行**同列位置（若下一行不存在则聚焦上一行）
- 若删除的是唯一一行，表格清空，焦点自然消失

### 工具栏变化

```
[字段 ▼] [筛选 ▼]              →  选中 N 行时  →  🗑️ 删除(N)  [全选]
```

### 数据更新

```typescript
const newBeats = scriptBeats.filter((_, i) => !selectedIndices.includes(i));
updateNodeData(nodeId, { scriptBeats: newBeats });
```

---

## 3. Feature 2: 行列移动（选中后移动）

### 交互

- 多选行后，工具栏出现"移动到"下拉菜单
- 菜单项：`↑ 上移一层` / `↓ 下移一层` / `⤒ 置顶` / `⤓ 置底`
- 单行操作：**不需要先点 Checkbox**，光标在该行时直接按 `Shift+↑` / `Shift+↓` 即上移/下移
- 多行操作：需先 Checkbox 选中，再执行移动

### 选中状态维护

- 移动后保持选中状态，自动滚动到可见区域

### 快捷键

- `Shift+↑` 上移一层
- `Shift+↓` 下移一层

### 数据更新

```typescript
// 移动逻辑：移除选中行 → 按方向插入到目标位置
const selected = beats.filter((_, i) => selectedIndices.includes(i));
const remaining = beats.filter((_, i) => !selectedIndices.includes(i));
// moveDirection: "up" | "down" | "top" | "bottom"
updateNodeData(nodeId, { scriptBeats: reordered });
```

---

## 4. Feature 3: 列宽拖拽调整

### 交互

- 鼠标悬停表头列分隔线区域（除最后一列外）→ 光标变成 `col-resize`
- 按住拖动 → 实时调整该列宽度（min-width 限制 60px）
- 双击 → 恢复该列默认宽度
- 列宽保存在组件 state，不持久化（刷新恢复）

### 实现

在每个 `<th>` 后（非最后一列）插入 resize handle div：

```tsx
<th style={{ width: colWidths[colId], minWidth: 60 }}>
  {label}
  {!isLastCol && (
    <div
      className="col-resize-handle"
      onMouseDown={(e) => startResize(e, colId)}
    />
  )}
</th>
```

Resize handler 通过全局 `onMouseMove` / `onMouseUp` 事件实现拖拽，`preventDefault` 阻止默认选择行为。

---

## 5. Feature 4: 快捷编辑体验

### 双击编辑模式

- **单击** → 选中该单元格（蓝色边框高亮）
- **双击** → 进入编辑模式（单元格变成 input/textarea）
- **Enter** → 确认输入，**跳转下一行同一列**（若在最后一行则新增一行）
- **Escape** → 取消编辑，恢复原值

### Tab / Shift+Tab 单元格导航（非编辑状态）

- 当前单元格按 `Tab` → 跳到同一行下一个可编辑单元格
- `Shift+Tab` → 反向跳
- 到达行尾再按 `Tab` → 自动新增一行并进入编辑

### 单元格编辑状态下 Tab 行为

- **编辑状态下**，`Enter` 跳转下一行同一列
- **编辑状态下**，`Tab` 跳转到**下一列同一行**（和浏览器默认行为区分开）

### Ctrl+A 全选（非编辑状态）

- `isEditing === false` 时按 `Ctrl+A` → 全选所有行（行高亮）
- `isEditing === true` 时按 `Ctrl+A` → 执行浏览器默认行为（选中文本）
- 点击行外空白区域或 `Escape` → 取消全选

### Delete 删除快捷键

- 任意状态：`Delete` / `Backspace` 直接删除当前行（单行模式，不需要 Checkbox）

---

## 6. Component Architecture

```
ScriptBeatsEditorTable.tsx        # 主组件，state 管理列宽、移动、选中、编辑
├── state: colWidths Record<colId, number>
├── state: selectedIndices Set<number>
├── state: editingCell { row: number, col: string } | null
├── state: isEditing boolean
├── Toolbar: 移动到下拉 + 删除按钮
├── TableHead: 列头 + resize handle（最后列除外）
├── TableBody: 行渲染 + 单元格单击/双击处理
└── onKeyDown 处理: Tab/Shift+Tab/Enter/Escape/Delete/Ctrl+A/Shift+Arrow
```

---

## 7. Files to Modify

| File | Change |
|------|--------|
| `src/components/ScriptBeatsEditorTable.tsx` | 主逻辑：列宽 state、选中 state、编辑 state、键盘处理、工具栏按钮 |
| `src/components/ScriptBeatsEditorTable.css` | 列宽拖拽样式、选中高亮、resize handle |

---

## 8. Out of Scope

- 批量复制行（未来扩展）
- 列宽持久化（刷新恢复）
- 拖拽式行排序（通过按钮+快捷键实现）
- 批量移动到指定位置（仅支持上移一层/下移一层）

---

## 9. Manual Acceptance Steps

1. 选中 3 行，点击工具栏 🗑️ 删除按钮，确认 3 行都被删除
2. 光标在某行，直接按 Delete 键，确认单行删除（无需点 Checkbox）
3. 光标在某行，按 Shift+↑ / Shift+↓，确认单行上移/下移
4. 选中 3 行后按 Shift+↑ / Shift+↓，确认多行整体上移/下移
5. 鼠标悬停列分隔线（除最后一列），确认光标变为 col-resize，拖动调整宽度
6. 双击单元格，确认进入编辑模式，输入内容后按 Enter 跳到下一行
7. 编辑状态下按 Tab，确认跳到下一列（编辑内容被确认）
8. 按 Ctrl+A 全选，确认所有行高亮
9. 单元格编辑时按 Ctrl+A，确认是文本选中而非行选中
10. 刷新页面，确认列宽恢复默认（不持久化）
11. 删除最后一行，确认焦点自动移到上一行
12. 工具栏"移动到"下拉菜单，确认置顶/置底/上移/下移各功能正常
