# 第 10 轮执行单：脚本节点入口收敛（script-10-1A）

> **状态**：已完成（2026-05-21）  
> **依据**：[脚本节点开发顺序.md](../product/脚本节点开发顺序.md) 阶段 1-A  
> **功能真源**：[脚本节点功能说明.md](../product/脚本节点功能说明.md) §3.3

## 1) 本轮目标（一句话）

四条编辑入口职责清晰：画布可直达 **全屏表格** 与 **编辑主题**，与 Inspector / 最大化工作台说明一致。

## 2) 变更范围

- `src/lib/scriptNodeCanvasEntries.ts`（共享入口 API + 文案）
- `MinimalScriptNode` + `ScriptNodeMiniPreview`（点击预览进全屏）
- `ScriptPreviewToolbar`（顶栏恢复全屏/主题图标钮）
- `NodeMaximizedOverlay`、`Inspector`（入口说明 + 全屏快捷钮）
- `scriptPreviewToolbarActions.ts`（动作目录与 0-B 文案对齐）

## 3) 功能清单

- [x] 顶栏：解析/分镜后增加 **全屏表格**、**编辑主题** 图标钮
- [x] 壳内迷你预览：点击（含键盘 Enter/Space）→ `openScriptFullscreen`
- [x] 空态壳：一行入口指引（底栏主题 · 解析后进全屏）
- [x] 最大化 Overlay 标题栏「全屏表格」+ 正文入口说明
- [x] Inspector 工作台上方统一 `SCRIPT_INSPECTOR_ENTRY_HINT`
- [x] 双击节点仍为 zoom 200%（不改 FlowCanvas）

## 4) 非目标

- 解析/分镜失败反馈（script-10-1B）
- 重写 `ScriptNodeWorkbench` / 全屏表布局

## 5) 验收步骤

1. 有镜头、单选脚本节点 → 顶栏可见 **全屏**、**编辑主题** 图标；点击分别打开全屏 Overlay / 主题 Modal。
2. 点击壳内迷你表任意区域 → 打开全屏；Esc 关闭后节点仍选中。
3. 空态节点 → 壳内显示「底栏编辑主题 · 解析后点击预览进全屏」。
4. 右键双击脚本节点 → 最大化工作台；标题栏 **全屏表格** 与 Inspector「全屏表格」行为一致。
5. 新用户路径：底栏写主题 → AI 解析 → 点预览或顶栏全屏改表 → 顶栏/侧栏生成分镜（≤3 分钟）。

## 6) UI/UX

| 界面 | 入口 |
|------|------|
| 画布壳（有镜头） | 点击预览 → 全屏 |
| 画布顶栏 | 重新解析 \| 生成分镜 \| 全屏 \| 主题 \| 下载 |
| 画布底栏 / Modal | 主题编辑（展开钮） |
| 全屏 Overlay | 大表 + 创意视图 |
| Inspector / 最大化 | 完整工作台 + 分镜区；文案指向顶栏/全屏 |

- **键盘**：预览区 Enter/Space 开全屏；Esc 关 Modal/全屏（既有行为）。
- **非目标 UI**：不在顶栏增加第五个文字主按钮（全屏/主题为图标）。

## 7) 风险与回退

- **风险**：预览区整区可点，与拖选节点冲突 → 仅在选中且 `hasBeats` 时启用；`stopPropagation` 避免冒泡到画布。
- **回退**：移除 `scriptNodeCanvasEntries` 调用，恢复仅三键顶栏；预览区去掉 `role=button`。
