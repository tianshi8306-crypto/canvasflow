# Iteration 53 — Agent Loop（步内 re-plan）

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §4.2

## 1) 目标

单个 `director_plan` Job 内：每步观察画布与上步结果，必要时插入依赖步骤或失败修复，再继续原计划队列。

## 2) 范围（3 模块）

- `hermesAgentLoop.ts` — observe / preflight / 失败续跑
- `hermesDirector.ts` — `executeDirectorPlanWithAgentLoop` 接入
- `hermesWorkstate` + `hermesAgentSettings` — loop 轮次与开关

## 3) 功能

1. 执行 `video.generate_for_beats` 前缺图/缺分镜 → 自动插入出图/补分镜
2. 可重试步骤失败 → 规则 recovery 插入队列（最多 3 次 replan）
3. `workstate` 记录 `loopRound` / `lastToolSummary`
4. 设置 `agentLoopEnabled`（关则回退固定计划顺序执行）

## 4) 非目标

- 每步完整 LLM 重规划
- 跨 Job 全局调度
- 外接 MCP 自动写画布

## 5) 验收

1. 计划先出视频但缺图 → 自动先 `image.generate_for_beats`
2. 出图失败 → 插入重试步，不盲目跑后续视频步
3. 关「步内智能调整」→ 与 iter-47 固定计划一致
4. `npm run quality:gate` 通过

## 6) UI/UX

- 侧栏进度行出现「↻ 重新规划：…」
- 设置 → Agent →「步内智能调整（缺图先出图等）」

## 7) 状态

✅ 已实现（iter-53）
