# Iteration 49 — 自动成功经验 + 失败反思

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §3.4、GS-4 · P1-b

## 1) 目标

制片 Job 完成后自动沉淀经验：成功步骤链写入 `memory.json`；含出图/出视频的多步成功另写 `skills/auto-*.md`，供下次规划参考。

## 2) 范围（3 模块）

- `hermesJobReflection.ts` — 规则化总结 + 去重 + 写入
- `HermesSidebar` — Job 执行器完成后调用反思
- 单测（纯函数）

## 3) 功能

1. 成功且 ≥2 个实质步骤 → `[proc:tool链]` 写入 agent 长期记忆
2. 含 media 工具的多步成功 → 额外写 `.canvasflow/hermes/skills/auto-*.md`
3. 失败（非 recovery 计划）→ `[fail:toolId]` 教训写入 memory
4. 同 procedureKey 不重复写 memory；聊天提示「已自动记录…」

## 4) 非目标

- LLM 反思摘要（规则化即可）
- 步内 re-plan loop
- `agentMaxConcurrentMedia` 镜级并发

## 5) 验收

1. 成功跑「分镜 → 出图」后 `memory.json` 出现 `[proc:…]` 条目
2. 同上工程 `skills/` 出现 auto skill 文件
3. 再次相同 tool 链成功不重复刷 memory
4. 失败步骤写入 `[fail:…]` 教训

## 6) 状态

✅ 已实现（iter-49）
