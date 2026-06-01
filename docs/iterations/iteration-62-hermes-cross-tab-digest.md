# Iteration 62 — 跨 Tab 合并 digest

> 延伸 [iteration-56](iteration-56-hermes-long-context.md) · [iteration-61](iteration-61-hermes-long-context-llm.md)

## 1) 目标

工程级 `conversationDigest` 纳入**所有画布 Tab** 的 Hermes 对话增量，而不只当前活跃 Tab。

## 2) 功能

1. `hermesCrossTabDigest.ts`：按 Tab 增量收集待压缩消息（前缀 `【Tab名】`）
2. `workstate.tabDigestedCounts`：记录各 Tab 已 digest 到的消息条数，避免重复
3. 活跃 Tab 仍保留最近 12 轮完整进 LLM；其它 Tab 全量增量进 digest
4. 用户约束从**全 Tab** 消息提取
5. 切换 Tab / 发消息 / 画布脚本变更时刷新

## 3) 非目标

- 跨工程合并
- 按时间戳全局排序多 Tab 对话（按 Tab 块顺序合并）

## 4) 验收

1. Tab A 聊「竖屏」、Tab B 聊「出图」→ `workstate.conversationDigest` 含两段 Tab 标记
2. `tabDigestedCounts` 随各 Tab 消息增长
3. `npm run test -- hermesCrossTabDigest` 通过

## 5) 状态

✅ 已实现（iter-62）
