# Iteration 46 — Agent 设置（自主/风险）+ 聊天不阻塞（第一步）

> 真源：[CANVAS_AGENT_SPEC.md](../product/CANVAS_AGENT_SPEC.md) §0

## 1) 目标

用户可在设置中控制 Agent 是否自动改脚本/分镜/批量生成；开启风险说明。H 在制片 job 运行期间仍可发送消息（咨询与新的制片指令分流）。

## 2) 范围（3 模块）

- `AppSettings` + 设置 UI「Agent」
- `hermesAgentSettings.ts` 读写与 guardrails
- `HermesSidebar`：发送条件不再依赖 `executingPlan` 单独阻塞（job 化前：至少允许 consult 通道）

## 3) 功能

1. 设置项：`agentAutoExecute`、`agentAutoBatch`、`agentAllowScriptEdit`、`agentAllowMediaSubmit` + 风险折叠文案
2. 关闭 `agentAutoExecute` 时恢复「先计划后执行」
3. `wantsConversationOnly` / `consult` 在 `executingPlan===true` 时仍可 `runChat`

## 4) 非目标

- 完整 Job 队列（iter-47）
- 自动成功经验（iter-48）

## 5) 验收

1. 设置页开关持久化  
2. 关自动 → 出图需确认/执行  
3. 开自动 + 执行中 → 仍可问「什么是蒙太奇」  

## 6) 状态

✅ 已实现（iter-46）
