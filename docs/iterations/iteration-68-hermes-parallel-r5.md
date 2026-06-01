# Iteration 68 — R5 多任务并行（对话 + 制片）

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §3.4 R5 · P0

## 1) 目标

制片 Job 执行中仍可咨询；对话流式输出中仍可发起制片计划入队；双通道互不阻塞输入框。

## 2) 范围

- `hermesParallelChannel.ts` — 并行策略
- `HermesSidebar` — 输入门控、对话代际、状态行
- 沿用 iter-47 Job 队列（同工程计划仍串行执行，避免画布写冲突）

## 3) 行为

| 场景 | 之前 | 现在 |
|------|------|------|
| 出图 Job 中问「蒙太奇」 | ✅ 已支持 | ✅ |
| 对话生成中又发「1-3 镜出图」 | ❌ 被 streaming 挡住 | ✅ 规划并入队 |
| 对话生成中又发咨询 | ❌ 被 streaming 挡住 | ✅ 新咨询顶替旧流 |
| 同工程两个制片计划 | 排队串行 | 仍排队串行 |
| 镜级出图/出视频 | `agentMaxConcurrentMedia` | 不变 |

## 4) 非目标

- 同工程多计划同时写画布
- 取消进行中的 Rust 侧 LLM 请求（仅前端忽略旧流 token）

## 5) 验收

1. 自动执行出图中 → 发「什么是蒙太奇」→ 顾问流式回复，任务轨继续
2. 顾问回复流式输出中 → 发「帮我把分镜出图」→ 计划入队 + 提示
3. 输入框仅 tipBusy / 语音转写时禁用
4. `npm run test -- hermesParallel` 通过

## 6) 状态

✅ 已实现（iter-68 / R5）
