# Iteration 73 — M5 任务结束后 LLM 复盘

> 真源：HERMES_CURSOR_AGENT_SPEC §3.6 M5 · §4.2 post_job

## 目标

制片 Job 完成后除规则 `[proc:]`/`[fail:]` 外，可选调用对话模型生成复盘结论写入记忆。

## 模块

- `hermesJobReflectionLlm.ts` — prompt、JSON 解析、`[reflect]`/`[avoid:llm_reflect]`
- `hermesJobReflection.ts` — `applyLlmReflectionLayer` 编排
- 设置 `agentPostJobLlmReflect`（默认开）

## 验收

1. 多步计划成功/失败后对话出现「已复盘：…」（有 Key 且开关开）
2. `.canvasflow/hermes/memory.json` 出现 `[reflect]` 行
3. 取消任务不写复盘
4. `npm run test -- hermesJobReflectionLlm` 通过

## 状态

✅ iter-73
