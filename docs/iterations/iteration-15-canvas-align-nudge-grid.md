# 迭代 15 — 画布对齐 C（微调 / 网格 / 快捷键）

**层**：CanvasExperienceLayer  
**目标**：方向键微调、拖拽结束网格吸附、常用对齐快捷键。

## 功能

- 方向键：选中节点 1px 微调；Shift+方向键 10px
- `snapGridEnabled`：拖拽结束时按「排列/分布间距」步长弱吸附（默认关）
- Alt+Shift：L/R/T/B/H/V 对齐；E/J 水平/垂直等距；G 切换网格吸附

## 模块

- `src/lib/nodeGridSnap.ts`、`src/lib/nodeCanvasNudge.ts`
- `projectStore.onNodesChange`、`nudgeSelectedNodes`
- `App.tsx`、`CanvasFlowChrome.tsx`、`SettingsPanel.tsx`

## 验收

1. 框选节点后方向键可 1px 移动，Shift 为 10px，可撤销
2. 设置开启网格吸附后拖放节点落点对齐 40px（或所选间距）
3. 框选 ≥2：Alt+Shift+H 水平居中；≥3：Alt+Shift+E 水平等距
4. Alt+Shift+G 与设置「吸附到网格」同步切换

## 回退

关闭网格吸附与对齐吸附设置；或 revert 本迭代提交。
