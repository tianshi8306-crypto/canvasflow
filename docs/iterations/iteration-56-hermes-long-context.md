# Iteration 56 — R4 长上下文摘要（workstate）

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §3.4 R4

## 1) 目标

长剧本与多轮对话不挤爆 LLM：工程梗概/镜头表摘要与较早对话 digest 写入 `workstate.json`，规划与聊天只送近期完整轮次。

## 2) 范围（3 模块）

- `hermesLongContext.ts` — 规则摘要 + 聊天裁剪
- `hermesWorkstate.ts` — 持久化字段 + prompt 格式化
- `HermesSidebar` — 发消息/入队前刷新

## 3) 功能

1. `projectContextSummary`：梗概 + 镜头表 + 分镜 visual + 圣经
2. `conversationDigest`：超过 12 轮的较早消息压成要点
3. `userConstraints`：「记住/不要/必须」提取
4. `trimChatHistoryForLlm`：仅最近 12 轮进 `chatHistory`

## 4) 非目标

- ~~LLM 自动摘要~~ → [iteration-61](iteration-61-hermes-long-context-llm.md)
- ~~跨 Tab 合并 digest~~ → [iteration-62](iteration-62-hermes-cross-tab-digest.md)

## 5) 验收

1. 多轮聊天后 `workstate.json` 含 `conversationDigest`
2. 有脚本节点后含 `projectContextSummary`
3. 规划/对话 prompt 中【工作记忆】可见摘要块
4. `npm run test -- hermesLongContext` 通过

## 6) 状态

✅ 已实现（iter-56 / R4）
