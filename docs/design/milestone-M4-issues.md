# 里程碑 M4（C.3）

## 目标

- 增加 `execute_subgraph` 命令：输入 `fromNodeId`（可选附带 `previousRunId`、`force`）执行子图。
- 默认不重跑上一次已成功节点（仅在同一子图内按 `node_state=succeeded` 跳过）。

## 本次实现

- 后端新增 `executor::run_subgraph(...)`。
  - 子图范围：`fromNodeId` 以及它的下游节点。
  - 读取 `previousRunId` 的 `run_events`，默认将已成功节点标记为 `skipped(reason=already_succeeded)`。
  - 保留 M3 失败策略：失败后可标记下游 `skipped`，并记录 `run_summary`。
- Tauri 新增命令 `execute_subgraph` 并暴露到前端。
- 前端 `RunPanel` 增加「重跑失败子图」按钮，调用 `projectStore.rerunFailedSubgraph()`。

## 验收建议

1. 先跑一次工作流制造失败节点，确认面板按钮可用。
2. 点击「重跑失败子图」后，检查新 run：
   - `run_start.payload.subgraphFromNodeId` 为失败节点；
   - 已成功节点显示 `skipped/already_succeeded`（默认模式）；
   - 失败节点与下游有新的运行状态。
3. 当无失败节点时，按钮应禁用并给出合理提示。
