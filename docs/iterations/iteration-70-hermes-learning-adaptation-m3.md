# Iteration 70 — M3 学习与适应

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §3.6 M3 · P1  
> 基础：iter-49 自动成功经验写入 `memory.json`

## 1) 目标

让 Hermes **消费**本工程已沉淀的成功路径与忽略偏好，在规划与主动建议中「越用越贴」。

## 2) 范围（3 模块）

- `hermesLearningAdaptation.ts` — 解析 `[proc:]` / `[avoid:]`、匹配、改计划
- `hermesDirector` + `hermesAgentContext` — 规划注入与 learned 补全
- `HermesSidebar` + `HermesProactiveChips` — 忽略写入 memory、跨会话过滤

## 3) 功能

1. 从 `memory.json` 解析 `[proc:tool链]`，按用户话术匹配最佳成功经验
2. 弱规则计划 / 无计划时 → `plannerSource: learned` 沿用历史步骤链
3. 当前计划为学习路径前缀时 → 自动补全后续常用步骤（如已「分镜→出图」补「出视频」）
4. Agent 上下文注入「学习适应」块（成功经验 + 已忽略建议）
5. 主动芯片 × 忽略 → `[avoid:id]` 写入 memory，新开会话也不再推荐

## 4) 非目标

- LLM 反思改写经验（仍用 iter-49 规则 `[proc:]`）
- 跨工程全局学习
- 手动画布操作自动写 proc（仍靠制片 Job 反思）

## 5) 验收

1. 跑通「分镜→出图」成功后，再说类似「帮我把分镜出图」→ 计划含 learned 或补全相同 tool 链
2. LLM/规则规划上下文可见「本工程成功经验」段落
3. × 忽略某芯片后 `memory.json` 有 `[avoid:…]`，重开工程仍不出现
4. `npm run test -- hermesLearning` 通过

## 6) 状态

✅ 已实现（iter-70 / M3）
