# Iteration 55 — 全链路失败修复（E3）

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §3.3 E3 · P1

## 1) 目标

`film.workflow_check` 与 Agent loop 联动：根据流程报告/制片快照自动生成修复步骤（补分镜、建链、重试失败视频等）。

## 2) 范围（3 模块）

- `hermesWorkflowRepair.ts` — 报告 → 修复步骤映射
- `hermesAgentLoop.ts` — preflight / 失败后 / workflow_check 后注入
- `hermesPlanFromIntent.ts` — 「流程检查并修复」

## 3) 功能

1. 失败后 `proposeWorkflowAwareRecoverySteps`（优先于 iter-42 recovery）
2. 导出/批量出图出视频前 `preflightWorkflowRepairSteps`
3. `workflow_check` 成功且 `autoRepair` → 按报告插入最多 4 步修复
4. 出视频前 `videoFailed>0` → 先 `video.retry_failed`

## 4) 非目标

- LLM 解读检查报告
- 无工程时自动新建工程

## 5) 验收

1. 「流程检查并修复」→ 单步 check（autoRepair），loop 自动跟修复步
2. 有失败视频时说「批量出视频」→ 先重试失败镜
3. 出图失败 → recovery 含补分镜/重试（依快照）
4. `npm run test -- hermesWorkflowRepair` 通过

## 6) 状态

✅ 已实现（iter-55）
