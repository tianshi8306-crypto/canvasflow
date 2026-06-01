# 迭代 28 — Hermes LLM 规划（规则兜底）

**层**：ProviderOrchestrationLayer + ProductionFlowLayer  
**核心目标**：规则未命中时，用 LLM 输出结构化 JSON 执行计划；规则仍负责明确口令快路径。

## 模块

1. `src-tauri` — `hermes_plan` / `plan_director`  
2. `src/lib/hermes/hermesPlanLlm.ts` — 解析与校验 toolId  
3. `proposeDirectorPlanAsync` + `HermesSidebar`「正在规划…」

## 策略

| 顺序 | 行为 |
|------|------|
| 1 | `buildDirectorPlan` 规则匹配 → 立即返回（`plannerSource: rules`） |
| 2 | 规则为 null → `invoke hermes_plan` |
| 3 | LLM 无效或失败 → 走纯聊天 `streamHermesChat` |

## 功能点

1. LLM 返回 `{ reply, assumptions, risks, steps[] }`  
2. 仅允许已注册 `HermesToolId`  
3. 计划气泡展示假设/风险与「AI 规划」提示  
4. 侧栏发送时显示「正在规划…」

## 非目标

- 用 LLM 替代所有规则（明确「出图」「导出」仍走规则）  
- 流式 plan / function calling  
- 自动执行无需确认

## 手工验收

1. 「帮我把分镜出图」→ 仍走规则（无 LLM 延迟）  
2. 「我想把这个赛博故事做到能导出，但还没想好几步」→ 规则未命中 → 规划后出现多步 AI 计划  
3. 「什么是分镜」→ 无计划，纯对话  
4. 未配置 Provider → 规则未命中后回落聊天

## 回滚

- 侧栏改回 `proposeDirectorPlan` 同步规则
