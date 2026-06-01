# Iteration 61 — R4 长上下文 LLM 摘要

> 延伸 [iteration-56-hermes-long-context.md](iteration-56-hermes-long-context.md)

## 1) 目标

`workstate` 的工程摘要与较早对话 digest 在规则压缩基础上，可选调用**对话模型**生成更紧凑、语义保留更好的摘要。

## 2) 功能

1. `hermesLongContextLlm.ts`：`llm_complete_text` 压缩工程/对话
2. `refreshHermesLongContext`：LLM 成功则写入；失败回退 iter-56 规则
3. 设置 **Agent → 长上下文摘要用 LLM**（`agentLongContextLlmSummary`，默认开）
4. 阈值：工程规则摘要 ≥280 字、较早对话 ≥2 条才调 LLM

## 3) 非目标

- 约束提取改 LLM（仍用规则「记住/不要」）
- 跨工程全局摘要

## 4) 验收

1. 开启设置 + 配置对话 Key → 多轮聊天后 digest 为语义化段落（非逐条截断）
2. 关设置 → 行为与 iter-56 一致
3. `npm run test -- hermesLongContext` 通过

## 5) 状态

✅ 已实现（iter-61）
