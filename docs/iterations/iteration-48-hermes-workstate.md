# Iteration 48 — 工作记忆（workstate）+ Agent 上下文

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §3.4、§4.2 P1-a

## 1) 目标

Agent 规划/对话时感知「正在干什么、排队任务、最近失败」；持久化到 `.canvasflow/hermes/workstate.json`。

## 2) 范围（3 模块）

- `hermesWorkstate.ts` — 读写 workstate + prompt 格式化
- `hermesAgentContext.ts` — 注入【工作记忆】块
- `HermesSidebar` — Job 生命周期同步 workstate

## 3) 功能

1. 入队制片计划时写入 `currentGoal`
2. Job 完成/失败后更新 `lastCompletedTitle` / `lastError` 与 `activeJobs`
3. LLM 规划（`hermesPlanLlm`）与对话 Brain 自动读取工作记忆

## 4) 非目标

- 步内 re-plan Agent loop（iter-49+）
- 自动成功经验写入 skills（iter-49）

## 5) 验收

1. 执行计划后工程内出现 `workstate.json`，含 activeJobs
2. 完成后 activeJobs 清空，lastCompletedTitle 有值
3. 失败时 lastError 写入，下一轮规划上下文可见

## 6) 状态

✅ 已实现（iter-48）
