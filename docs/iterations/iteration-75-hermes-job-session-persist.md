# Iteration 75 — Job 会话内持久化

## 目标

刷新页面或重开 Hermes 后仍可在任务中心查看本会话已完成/失败/已取消的制片 Job（不含执行中步骤的完整 payload 重放）。

## 模块

- `hermesJobPersistence.ts` — sessionStorage 序列化（精简 plan steps）
- `hermesJobStore` — `hydrateHermesJobsForProject`、`schedulePersistJobs`
- `HermesSidebar` — `projectPath` 变化时 hydrate

## 非目标

- 跨浏览器/跨设备同步
- 磁盘级 Job 历史库

## 验收

1. 完成一条制片任务 → 刷新（同 tab session）→ 任务中心仍显示该条历史
2. `npm run test -- hermesJobPersistence` 通过

## 状态

✅ iter-75
