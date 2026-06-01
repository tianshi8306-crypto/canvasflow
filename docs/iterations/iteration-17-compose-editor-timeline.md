# 迭代 17 — 视频剪辑工作台 B（时间线 MVP）

**层**：ProductionFlowLayer  
**目标**：全屏工作台接入片段预览、单轨时间线、刷新/导出。

## 功能

- `useComposeNodeEditor`：刷新、排序、重排、删除、导出、定位源节点
- 预览区：选中片段播放；导出后可切换「看成片」
- 时间线：单轨块、点击选中、拖拽排序、时长比例宽度
- 顶栏：从连线刷新、按脚本排序、导出成片

## 模块

- `ComposeEditorBody`、`ComposeTimelineTrack`、`ComposeEditorPreview`
- `hooks/useComposeNodeEditor.ts`

## 验收

1. 连线 2+ 视频 → 刷新 → 时间线显示缩略图条
2. 点击片段 → 上方预览切换；拖拽调序后导出顺序正确
3. 导出成功 → 「看成片」可播；节点主面板同步 `path`

## 回退

Revert 迭代 17；迭代 A 壳层仍可用（需恢复占位文案）。
