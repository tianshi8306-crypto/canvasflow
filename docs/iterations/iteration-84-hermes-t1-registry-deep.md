# iter-84 · Hermes T1 Registry 深化

## 1) 本轮目标

Canvas Tool Registry 成为规划/执行 gate 与 LLM 上下文的单一真源：风险分级、参数摘要、Agent 开关对齐。

## 2) 变更范围

- `hermesToolRegistry.ts`
- `hermesAgentSettings.ts`（`isPlanStepAllowed` 走 Registry）
- `hermesAgentChat.ts`（`list_tool_registry`）

## 3) 功能清单

- `riskTier` / `agentGate` / `inputSummary` 字段
- catalog 外 Director 工具 `SUPPLEMENT` 补全
- `getHermesToolRegistryEntry` + `isRegistryToolAllowed`
- Prompt 含风险、参数、gate 提示
- 对话「工具 registry」列出完整表

## 4) 非目标

- JSON Schema 校验运行时参数
- 外接 MCP 工具并入同一 Registry 文件

## 5) 验收

1. 关闭「自动提交出图」→ 计划步 `image.generate_for_beats` 被 gate
2. Agent 上下文工具块含 `参数:` 与 `需 mediaSubmit`
3. 说「工具 registry」返回分类列表
4. `npm run test -- hermesToolRegistry`

## 6) UI/UX

本轮无 UI 变更。

## 7) 回退

恢复 `isPlanStepAllowed` 硬编码 Set。
