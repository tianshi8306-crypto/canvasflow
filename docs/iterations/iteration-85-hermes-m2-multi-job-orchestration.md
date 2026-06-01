# iter-85 · Hermes 多 Job 编排（制片队列 M1+）

> 注：规格 §3.6 的 **M2=多工程 Tab** 已具备；本轮为 **制片 Job 队列编排**（用户口语「M2 多 Job」），对齐 §5 Job 队列。

## 1) 本轮目标

同一工程内多个 `director_plan` 可排队、优先、批量取消，UI 与对话可见队列状态。

## 2) 变更范围

- `hermesJobOrchestration.ts`、`hermesJobStore.ts`
- `hermesJobCenterModel.ts`、`HermesJobCenter.tsx`
- `HermesSidebar.tsx`、`hermesAgentChat.ts`

## 3) 功能清单

- `queuePriority` + `pickNextQueuedDirectorJob`（高优先级先、FIFO）
- `enqueueAtFront` / `priority: high`（话术「优先执行」「插队」）
- `cancelAllQueuedDirectorPlans`、`bumpDirectorJobToFront`
- Job 中心「排队 #n」
- 对话：`制片队列`、`取消全部排队`

## 4) 非目标

- 同工程双 `director_plan` 并行（仍为 1 running）
- 跨工程统一队列

## 5) 验收

1. 连发两个制片指令 → 第二个排队，Job 中心显示 #1/#2
2. 第二句含「优先执行」→ 插队到队首
3. 「取消全部排队」清空 queued
4. `npm run test -- hermesJobOrchestration hermesJobStore`

## 6) UI/UX

- Job 卡片 badge：`排队 #n`
- 入队进度行带队列首行摘要

## 7) 回退

`drainQueue` 恢复 FIFO `reverse().find`；去掉 `queuePriority`。
