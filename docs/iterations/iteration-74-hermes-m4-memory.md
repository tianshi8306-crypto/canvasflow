# Iteration 74 — M4 长期记忆增强

## 目标

强化工程记忆检索、分组展示与用户画像写入路径。

## 功能

1. 记忆标签：`procedure` / `failure` / `avoid` / `reflect` / `pref` / `user`
2. 中文二元组 token 检索 + 去重 `dedupeMemoryFacts`
3. `formatHermesMemoryForPrompt` 按类分组
4. 对话「画像：…」「更新画像：…」→ `userProfile` + `[pref:]`
5. `mergeHermesUserProfile` / `appendHermesMemoryFactsIfNew`

## 验收

1. 说「画像：竖屏快节奏」→ 侧栏确认写入
2. Agent 上下文【记忆】含「用户画像」与分组列表
3. `npm run test -- hermesPersistentMemory hermesMemoryIntent` 通过

## 状态

✅ iter-74
