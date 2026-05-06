# 里程碑 M3（C.1 + C.2）

## 目标

- **C.1**：节点级状态写入 `run_events`（`kind: node_state`，`payload` 含 `state`）。
- **C.2**：默认「失败则沿有向边标记下游为 skipped」；可在设置中开启「任一节点失败则中止整图」（`abortWorkflowOnFailure`）。

## 实现要点

- `executor::run_graph`：拓扑顺序执行；`node_state`: running → succeeded | failed | skipped。
- 失败且未开启中止时：`graph::downstream_descendants` 将下游 id 加入跳过集合。
- 运行结束写 `run_summary`（`anyNodeFailed` 等）。
- 前端：`list_run_events` → `deriveNodeRunStatesFromEvents` → `nodeRunStateById` → `NodeRunBadge`（`NodeFrame` / Group）。

## 验收建议

1. 构造 A→B→C，让 A（如 LLM）失败：B、C 为「跳过」，状态栏「部分失败」。
2. 设置中勾选「中止整图」后重试：首失败后 invoke 报错，运行记录为 failed。
3. 不支持类型节点：应为「跳过」（unsupported_type），不标为成功。
