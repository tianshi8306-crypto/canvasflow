# iter-83 · Hermes E2 版本链与 Agent 联动

## 1) 本轮目标

脚本版本链进入规划/执行/主动建议闭环，而不仅是对话命令与手动对比。

## 2) 变更范围

- `hermesScriptVersionAgent.ts`、`hermesScriptVersion.ts`
- `runHermesTool.ts`、`hermesAgentContext.ts`
- `hermesProactiveSuggestions.ts`、`HermesSidebar.tsx`

## 3) 功能清单

- 写脚本工具前 `pre:` 预快照，成功后 message 附带快照 id
- 制片意图下 Agent 上下文注入「脚本版本链」与最近 diff 摘要
- 主动芯片「版本对比」（≥2 快照）
- `HermesToolRunResult.scriptVersionId` 字段

## 4) 非目标

- Job 与版本 id 持久关联表
- 自动回滚失败 patch

## 5) 验收步骤

1. 执行「生成镜头大纲」后，步骤完成文案含 `脚本快照`
2. 对 Hermes 说「版本对比」，文本 diff + 浮层打开
3. 有 2+ 快照时侧栏出现「版本对比」芯片
4. `npm run test -- hermesScriptVersionAgent`

## 6) UI/UX

- 执行进度行附带快照提示（文本）
- 主动芯片与既有「版本对比」按钮一致

## 7) 风险与回退

- 风险：预快照增多占满 24 条上限
- 回退：去掉 `maybePreSnapshotScriptVersion` 与上下文块
