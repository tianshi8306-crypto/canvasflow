# 迭代 14 — 画布节点对齐（A+B）

**层**：CanvasExperienceLayer  
**目标**：拖拽智能吸附 + 多选对齐/分布，统一间距与设置项。

## 功能

- 六向边/中心吸附（12px），横竖辅助线
- 多选：左/右/顶/底/水平居中/垂直居中；水平/垂直等距（≥3）
- 设置：吸附开关、辅助线开关、排列间距 24/40/80

## 模块

- `src/lib/nodeSnapAlignment.ts`、`NodeSnapGuideOverlay.tsx`
- `src/lib/nodeAlignCommands.ts`、`projectStore` align/distribute
- `MultiSelectionToolbar`、`CanvasContextMenus`、`SettingsPanel`

## 验收

1. 拖节点靠近另一节点出现参考线并吸住
2. 框选 ≥2 → 工具栏对齐；≥3 → 等距可用
3. 设置关闭辅助线后仅吸附无线
4. Undo 可恢复对齐/分布

## 回退

Revert 本迭代提交；或设置关闭「节点对齐吸附」。
