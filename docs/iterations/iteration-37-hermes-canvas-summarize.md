# Iteration 37 — Hermes `canvas.summarize` 真实现

- **层**：ProductionFlowLayer
- **目标**：只读汇总工程制片状态，可作为独立计划或计划内首步；不再误报为执行失败。

## 变更

- `summarizeCanvasTool.ts`：复用 `buildHermesSituation`，支持 `beatIds` 镜号明细
- `executeDirectorPlan`：移除对 summarize 的特殊中断
- `HermesSidebar`：允许仅含 summarize 的计划走 Director 流程
- 低风险自动执行包含 `canvas.summarize`、`film.workflow_check`
- 技能芯片「制片摘要」

## 验收

1. 已打开工程，说「看看制片进度」→ 自动或一键执行，对话出现分镜/出图/视频/待办摘要
2. 说「第 2 镜什么情况」→ 摘要含该镜明细行
3. 未打开工程 → 提示先打开工程（不进失败态计划）
