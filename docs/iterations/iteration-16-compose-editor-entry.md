# 迭代 16 — 视频合成入口收敛（迭代 A）

**层**：CanvasExperienceLayer  
**目标**：合成节点仅作画布入口；全屏 CapCut 式壳层；移除底栏 Portal。

## 功能

- `composeEditorNodeId` + `ComposeEditorOverlay`（上预览 / 下时间线占位）
- 入口卡片：500×16:9、外置标签/状态、「进入剪辑」按钮
- 双击节点 / 视频节点「多段合成」/ 脚本导出合成 → 打开工作台
- 移除 `FFmpegConcatPanelPortal` 挂载

## 模块

- `MinimalFFmpegNode.tsx`、`ComposeEditorOverlay.tsx`
- `canvasUiStore`、`App.tsx`、`FlowCanvas.tsx`、`projectStore.openVideoClipConcat`

## 验收

1. 选中合成节点无底栏 Portal
2. 双击或点「进入剪辑」→ 全屏工作台，Esc/返回关闭
3. 顶栏刷新/导出按钮暂禁用（迭代 B 接线）

## 回退

Revert 本迭代；或临时在 `MinimalFFmpegNode` 恢复 Portal。
