# Iteration 50 — 画布事件感知 + 主动建议

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §3.1 I2/I3 · P1-c

## 1) 目标

用户手改分镜/选中镜头/改圣经后，Hermes 在**下一轮规划与对话**中感知；灵体 Orb 基于缺口与「分镜已改但图未更新」等场景主动建议。

## 2) 范围（3 模块）

- `hermesCanvasEvents.ts` + `hermesCanvasEventCache.ts` — 检测、去重、写入 workstate
- `initHermesCanvasAwareness.ts` — 订阅 projectStore / bible
- `hermesOrbSuggestions` + `hermesAgentContext` — 建议策略与上下文注入

## 3) 功能

1. 分镜文案/状态变更 → `storyboard_edited` 事件入 `workstate.recentCanvasEvents`
2. 选中单节点（含镜号）→ `selection_focused`
3. 圣经角色数变化 → `bible_updated`；制片指纹跃迁 → `production_shift`
4. Orb：镜号分镜已改且已有图 →「重新出图」；`situation.gaps` 带 `suggestedPrompt` → 一键交给 Hermes
5. Agent 上下文【工作记忆】/【画布感知】含近期事件列表

## 4) 非目标

- 画布 undo 栈级 diff
- 自动执行建议（仍预填话术）
- 顶栏全局通知中心

## 5) 验收

1. 手改某镜 visualPrompt → 问 Hermes「刚才改了什么」→ 能引用近期画布变化
2. 该镜已有图 → Orb 提示重新出图
3. 缺分镜时 gaps 建议「生成分镜」可一键展开 Hermes
4. 切换工程 → 事件与建议按工程隔离

## 6) 状态

✅ 已实现（iter-50）
