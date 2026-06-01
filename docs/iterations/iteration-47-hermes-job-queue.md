# Iteration 47 — Job 队列 + 轻量任务轨

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §5、§8 P0-b

## 1) 目标

制片计划异步排队；执行中仍可发新的制片指令（入队）；侧栏展示轻量任务轨与排队状态。

## 2) 范围（3 模块）

- `hermesJobStore.ts` — director_plan 队列与顺序执行
- `HermesSidebar` — 移除 `executingPlan` 阻塞，改 enqueue
- `HermesTaskTrack` + `hermesTaskStore.upsertPlanJob` — 计划级任务展示

## 3) 功能

1. 同一工程 director_plan 串行执行，后续计划 `queued`
2. 执行中用户发 execute 类消息 → 规划后入队 + 提示「已加入队列」
3. consult 通道始终可用；composer 不因制片 job 禁用
4. 任务轨显示计划级 job（排队/进行中/完成/失败）

## 4) 非目标

- 镜级 media 并发上限（`agentMaxConcurrentMedia`）→ iter-51 ✅
- workstate / Agent loop（iter-48）

## 5) 验收

1. 开自动 → 「1–6 镜出图」执行中再发「解释赛博朋克」→ 顾问回复 + 出图继续
2. 执行中再发「分镜出图」→ 第二条计划排队，任务轨可见
3. 输入框始终可输入（除 streaming / tipBusy）

## 6) 状态

✅ 已实现（iter-47）
