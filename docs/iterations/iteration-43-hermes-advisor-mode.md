# Iteration 43 — Hermes 顾问模式与意图三分流

## 1) 本轮目标（一句话）

让用户在 H 里**稳定获得电影/泛知识咨询**（顾问模式 + 知识检索），并与**制片执行**分轨；混合句先答咨询再自动执行。

## 2) 变更范围（最多 3 个模块）

- **ProductionFlowLayer**：`hermesMessageIntent`、`HermesSidebar` 分流、`hermesDirector` / `hermesPlanLlm`
- **ProviderOrchestrationLayer**：`hermes_agent` 顾问 system prompt、`hermes_chat_stream` 参数
- **AssetAndQualityLayer**：`hermes-knowledge/creative/film-literacy.md`、检索 scene 扩展

## 3) 功能清单

1. **意图三分流**：`consult` | `execute` | `mixed`（`hermesMessageIntent.ts`）
2. **顾问模式**：纯咨询跳过 Director，专用 `HERMES_ADVISOR_PROMPT` + 多场景 RAG
3. **混合句**：Director 计划带 `plannerReply` 前置；规划时注入 `film_theory` 知识
4. **制片关键词扩充**：梗概/圣经/一键等计入执行意图

## 4) 非目标（本轮不做）

- 联网搜索、Nous Hermes 集成
- iter-44 全自动跑片 DAG / 任务台
- 跨 Tab 全局记忆（仍工程+Tab 分桶）

## 5) 验收步骤

1. 输入「什么是蒙太奇？」→ 流式顾问回答，**不**触发出图/计划执行
2. 输入「分镜出图」→ 自动 Director 计划并执行（与 iter-40 一致）
3. 输入「参考《银翼杀手》霓虹雨夜，帮 1-3 镜出图」→ 计划气泡含风格摘要 + 步骤，并自动执行
4. 输入「推荐几部科幻片」→ 顾问回答；检索命中 `film-literacy`（Tauri 下）
5. `npm run test -- src/lib/hermes/hermesMessageIntent.test.ts`

## 6) UI/UX

- **关键界面**：H 浮窗/侧栏对话、输入框 placeholder 文案
- **关键状态**：纯咨询仅流式气泡；执行仍有 `▶/✓/✗` 进度行
- **本轮 UI 非目标**：不改灵体 Orb 动效

## 7) 风险与回退

- **风险**：误判为纯咨询导致「出图」不执行
- **触发**：明确「分镜出图/导出」无计划
- **回退**：还原 `HermesSidebar` 分流与 `hermesMessageIntent.ts`

## 8) 完成定义（DoD）

- [x] 单测通过
- [x] 代码已交付（手工验收见 iter-44 联调）
