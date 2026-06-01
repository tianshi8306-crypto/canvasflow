# 迭代 18 — 视频剪辑工作台 C（刻度 / 连播 / 定位）

**层**：CanvasExperienceLayer  
**目标**：时间线刻度与播放头、顺序连播、定位源节点 fitView。

## 功能

- 刻度尺 + 红色播放头（随播放/点击时间线更新）
- 点击时间线 seek；预览区「顺序连播」自动跳下一段
- 「定位源节点」选中并 `fitView`（`canvasFitRequestNodeId`）

## 模块

- `lib/compose/timelineLayout.ts`
- `hooks/useComposeNodeEditor.ts`（playhead / sequence）
- `ComposeTimelineTrack.tsx`、`ComposeEditorPreview.tsx`
- `canvasUiStore` + `FlowCanvas` fit 消费

## 验收

1. 刷新片段后时间线有刻度，播放时播放头移动
2. 顺序连播 2+ 片段可连续预览
3. 定位源节点后画布视口聚焦该视频节点

## 回退

Revert 迭代 18；B 仍可用（无播放头/连播）。
