# 迭代 29 — HermesSituation 制片感知 + 提案卡

**层**：ProductionFlowLayer + CanvasExperienceLayer  
**核心目标**：结构化统计脚本/分镜/关键帧/视频/导出缺口，注入 Brain 与 LLM 规划；侧栏展示可点击提案。

## 模块

1. `src/lib/hermes/hermesSituation.ts` — `buildHermesSituation` / `formatHermesSituationForLlm`  
2. `src/components/hermes/HermesSituationCard.tsx` — 制片摘要 + 缺口提案  
3. `hermes_chat_stream` — system 注入「制片进度感知」

## 功能点

1. 统计：分镜就绪/缺文案、关键帧、可批量视频、可导出镜数  
2. `gaps[]`：block/warn/info + 可选 `suggestedPrompt` 填入输入框  
3. LLM 规划 `hermes_plan` 使用完整 situation 文本（替代仅 ctx 短摘要）  
4. 纯聊天流同样注入 situation（Rust `build_hermes_messages`）

## 非目标

- Orb 主动弹建议（iter-31）  
- 项目圣经 / 角色参考（iter-30）  
- 替换 Rust 资产卡 DAG 摘要

## 手工验收

1. 打开有脚本、分镜无图的工程 → 侧栏显示「还缺 N 镜关键帧」，点击可填入「帮我把分镜出图」  
2. 与 Hermes 对话「我现在卡在哪」→ 回答应提及关键帧/视频缺口（需已配置 Provider）  
3. 模糊长句触发 LLM 规划 → plan prompt 含关键帧/导出行  
4. 未打开工程 → 显示 block 提示，不误导为可生成

## 回滚

- 移除 `HermesSituationCard` 与 `situation_summary` 参数，恢复 iter-28 仅 `summarizeCanvasForDirector` 给 plan
