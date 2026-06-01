# Iteration 67 — E2 可视化版本 diff

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §3.3 E2 · iter-63 延伸

## 1) 目标

脚本/分镜版本快照支持**可视化对比**：字段级增删改、梗概并排、一键回滚。

## 2) 范围

- `hermesScriptVersionDiff.ts` — 结构化 diff
- `HermesScriptVersionDiffOverlay.tsx` — 全屏浮层
- Hermes 输入区「版本对比」入口 + 话术打开

## 3) 功能

1. 旧版/新版下拉选择（默认最近两档）
2. 镜头表、分镜：新增/删除/变更行 + 字段 before→after
3. 梗概双栏对比
4. 「回滚到旧版」按钮
5. 话术「版本对比」同步打开面板

## 4) 非目标

- 分支合并、三路 merge
- 非脚本节点

## 5) 验收

1. ≥2 快照时 Hermes 底部「版本对比」可打开浮层
2. 修改镜表后 diff 显示变更字段
3. 回滚后画布脚本节点恢复
4. 单测 `hermesScriptVersionDiff` 通过

## 6) 状态

✅ 已实现（iter-67 / E2-visual）
