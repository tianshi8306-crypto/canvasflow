# 迭代 21 — 剪辑工作台抛光（胶片 / 右键 / 布局）

**层**：CanvasExperienceLayer  
**目标**：时间线视觉与交互对齐专业剪辑软件底线。

## 功能

- **多帧胶片**：每格 seek 到片段 in～out 区间内不同时间点
- **片段角标**：名称 + 有效时长（mm:ss）
- **右键菜单**：分割、修剪入/出点、定位源节点、删除
- **布局**：轨高 56px、选中白框 + 青色底条、刻度小竖线、时间线区占比收紧

## 模块

- `ComposeFilmstripFrame.tsx`、`composeFilmstripLayout.ts`
- `ComposeTimelineContextMenu.tsx`、`ComposeTimelineTrack.tsx`
- `composeEditorTimeline21.css`

## 验收

1. 时间线片段可辨认多帧画面（非纯色竖条）
2. 右键片段出现菜单，删除/分割可用
3. 选中片段白框 + 底部青条，轨道无大块空白
4. `composeFilmstripLayout.test.ts` 通过

## Out of scope

- 多轨音频、转场、AI 人声分离

## 回退

移除 `composeEditorTimeline21.css` 引用并 Revert 迭代 21 组件。
