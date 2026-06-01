# Iteration 51 — 镜级 agentMaxConcurrentMedia 并发

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §5.2、§6.1

## 1) 目标

设置 → Agent「同时媒体生成任务上限」在批量出图/出视频时生效：最多 N 镜（1～3）并行提交 API，而非严格顺序。

## 2) 范围

- `src/lib/async/runPool.ts` — 通用并发池
- `batchGenerateImages.ts` / `batchGenerateVideos.ts` — `maxConcurrent` 参数
- Hermes 工具链 + 脚本工作台批量按钮 — 读取 `getAgentMaxConcurrentMedia()`
- `hermesSubagent` — 并行子 Agent 默认用同一上限

## 3) 验收

1. 设置并发=2 → 批量 6 镜出图，状态栏显示「并发 2 镜」，任务轨进度仍更新
2. 设置并发=1 → 行为与原先顺序提交一致
3. Hermes「分镜出视频」/ 工作台批量视频 均受同一设置约束

## 4) 状态

✅ 已实现
