# Iteration 72 — 取消执行中 Job + T1 工具 Registry

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §3 T1 · M1 补强

## 1) 目标

用户可在制片任务中心停止**正在执行**的 `director_plan` Job；LLM 规划上下文中的 Canvas MCP 工具按副作用分组展示（T1 Registry 打磨）。

## 2) 范围（3 模块）

- `hermesJobStore` + `hermesDirector` / `hermesAgentLoop` — 取消信号与步间 `shouldAbort`
- `HermesJobCenter` / `HermesSidebar` — 进行中「停止」、取消后不跑 recovery
- `hermesToolRegistry` — 分类 + `formatHermesToolRegistryForPrompt`

## 3) 功能

1. 排队 Job：立即 `cancelled`（与 iter-71 一致）
2. 执行中 Job：`requestDirectorJobCancel` → 下一步前中止 → Job `cancelled`
3. 对话进度行显示「任务已取消」
4. 工具表按只读 / 脚本 / 画布 / 媒体 / 导出 / 编排分组，并标注副作用

## 4) 非目标

- Job 历史持久化、跨工程面板
- 取消已提交的镜级出图/出视频后台任务（仍走节点侧取消）
- 外接 MCP 进程生命周期管理

## 5) 验收

1. 执行多步计划 → Job 中心点「取消/停止」→ 状态变已取消，不再执行后续步
2. 取消后对话区出现「任务已取消」
3. Agent 上下文工具块含分组标题与 `[写画布]` 等副作用标签
4. `npm run test -- hermesJobStore hermesToolRegistry` 通过

## 6) 状态

✅ 已实现（iter-72）
