# 第 8 轮执行单：脚本节点 Chrome UI 对齐图片节点

> **状态**：P0–P2 已完成（2026-05-21）  
> **规范**：[`docs/node-ui-spec/canvas-node-chrome-spec.md`](../node-ui-spec/canvas-node-chrome-spec.md) §6–§7  
> **基准实现**：`MinimalImageNode` + `ImageGenerationPanel`；第二参考 `TextNode` + `TextComposerPanel`

## 1) 本轮目标（一句话）

将脚本节点从卡内一体式 UI 迁入 **LibTV Chrome 体系**（壳预览 + Portal 底栏/顶栏 + 外置元信息），视觉与交互对齐图片节点。

## 2) 变更范围（最多 3 个模块）

- **M1 节点壳**：`MinimalScriptNode.tsx` + `MinimalScriptNode.css`（替换 `ScriptNode.tsx` 注册）
- **M2 底栏 Composer**：`ScriptComposerPanel` + Portal + ExpandedModal + `canvasUiStore` pin/expand
- **M3 顶栏**：`ScriptPreviewToolbar` + Portal + `scriptPreviewToolbarActions.ts`

## 3) 功能清单（P0 → P1）

### P0（先做）

- 壳：`NodeChromeShell` + 外置 `NodeMetaLabel` / `NodeMetaStatus`（镜头数或生成中 %）
- 空态壳占位；有 beats 时壳内 `scriptNodeMiniGrid` 迷你表（最多 4 行 + 「查看全部」）
- 底栏 `ScriptComposerPanel` Portal（`empty` / `default`），500px，`scriptGenPanel--chrome` token
- `MentionInput` + `/` `@` + 右下角 counter + `sgp-generate-btn`（复用 `IgpGenerateButtonIcon`）
- `ScriptModelPicker`（Portal，对齐 `TextProviderPicker`）
- 修复 beats 显隐：以 `scriptBeats.length` 为准，不用静态 `useState`
- `canvasUiStore`：`scriptGenPanelExpandedNodeId`、`scriptGenPanelPinnedNodeId`

### P1（已完成）

- 顶栏 Portal（有 beats + 单选）：重新生成、生成分镜、导出、打开全屏、编辑主题
- `ScriptPreviewToolbar` + `scriptPreviewToolbarActions.ts` + `scriptNodeExport.ts`
- 双击脚本节点 → zoom 2.0 居中（`useFocusScriptNodeViewport`）
- `NodeSelectionToolbar` 对 `scriptNode` return null（`usesNodeChrome`）

### P2（已完成）

- 清理 `global.css` 中 `script-node-*`、`scriptGenNode` NodeCard、旧浮层底栏等 dead CSS；迷你表样式迁入 `MinimalScriptNode.css`
- 空态「从文本同步」浮动钮（`ScriptNodeUpstreamTextFloat` + `buildScriptPromptFromUpstreamText`）
- 底栏「标记」按钮 + `markedNodeId` 定位（对齐图片节点）

## 4) 非目标（本轮不做）

- 镜头表字段、列定义、批量 Agent 逻辑改版
- `ScriptNodeWorkbench` / `ScriptNodeFullscreenOverlay` 业务重写（仅改入口挂载）
- Hermes 自动链、后端真实进度 WebSocket
- 移除 Inspector 内完整工作台
- RunningHub 规范全文（算力条、标题栏四按钮等）对齐

## 5) 已确认产品决策（2026-05-21）

| 决策点 | 结论 |
|--------|------|
| 主题编辑 vs 镜头表 | 主题 → 底栏 Modal；镜头表 → 全屏 `ScriptNodeFullscreenOverlay` |
| 双击节点 | 画布 zoom 200% 居中，**不**直接打开全屏 |
| Inspector | **保留**完整 `ScriptNodeWorkbench` |
| 强调色 | 整体中性灰 + 白 CTA；teal 仅作壳内小标签（`scriptNodeViewTag`） |
| 实现策略 | **整体替换** `ScriptNode.tsx`，不修补卡内旧 UI |

## 6) 验收步骤（纯手工）

1. 新建脚本节点并**单选**：底栏 500px Portal 出现，壳为空态，无卡内紫 indigo 标题条。
2. 输入主题并「生成镜头」：壳显示迷你表，顶栏出现（P1），底栏收起；钉住后底栏再出现。
3. **多选**脚本 + 图片：两者均不显示 Portal/顶栏。
4. 顶栏或底栏「全屏」→ `ScriptNodeFullscreenOverlay`；Esc 关闭后节点仍选中。
5. 生成中右上显示「生成中 N%」（`data.status` + `useNodeStatus`）。
6. Inspector 仍可打开完整工作台编辑镜头（回归）。

## 7) UI/UX

- **关键界面**：画布节点壳、底栏 Portal、顶栏 Portal、Composer 展开 Modal、全屏 Overlay、Inspector 工作台。
- **关键状态**：
  - 未选中：仅壳
  - 选中无 beats：底栏 empty
  - 选中有 beats：壳迷你表 + 顶栏；底栏默认隐藏，钉住后 default
  - 生成中：CTA ■ 停止 + 右上进度文案
  - 失败：底栏 `sgp-feedback--block`
- **键盘与焦点**：Esc 先关 Modal 再关全屏；Portal 内输入不触发画布删除；与 `FlowCanvas` 输入白名单一致。
- **Token**：`NODE_CHROME_SCRIPT_PANEL_CLASS` = `nodeChrome--panel` + `scriptGenPanel--chrome`；`--sgp-*` 对齐 `--igp-*`。
- **本轮 UI 非目标**：不改全屏表布局、不改分镜 Section 样式。

## 8) 风险与回退

- **主要风险**：与 `ScriptNodeFullscreenOverlay` / Inspector 动作重复；旧 `global.css` 样式冲突。
- **触发条件**：多选仍出现 Portal；beats 生成后壳仍空态；钉住失选未清除全局 pin。
- **回退动作**：`nodeTypes.scriptNode` 指回旧 `ScriptNode.tsx`；移除 `canvasUiStore` 脚本 pin 字段；删除 `MinimalScriptNode*` 与新 CSS。
- **回退后保留**：验收失败截图、节点 `canvasflow.json` 样例。

## 9) 完成定义（DoD）

- P0 验收 1–2、5–6 通过；P1 验收 3–4 通过。
- `npm run typecheck` 无新增错误。
- `canvas-node-chrome-spec.md` §7.1 `scriptNode` 行更新为 ✅（实现后）。

## 10) 拟新增文件索引

| 文件 | 职责 |
|------|------|
| `src/components/nodes/MinimalScriptNode.tsx` | 节点入口 |
| `src/components/nodes/MinimalScriptNode.css` | `--sgp-*`、壳预览 |
| `src/components/nodes/ScriptComposerPanel.tsx` | 底栏内容 |
| `src/components/nodes/ScriptComposerPanelPortal.tsx` | 底栏 Portal |
| `src/components/nodes/ScriptComposerPanelExpandedModal.tsx` | 展开 Modal |
| `src/components/nodes/ScriptPreviewToolbar.tsx` | 顶栏内容 |
| `src/components/nodes/ScriptPreviewToolbarPortal.tsx` | 顶栏 Portal |
| `src/lib/scriptPreviewToolbarActions.ts` | 顶栏 actions 数据 |
| `src/hooks/canvas/useFocusScriptNodeViewport.ts` | 双击聚焦 |
| `src/components/nodes/nodeChrome/chromeClassNames.ts` | 增加 `NODE_CHROME_SCRIPT_PANEL_CLASS` |
