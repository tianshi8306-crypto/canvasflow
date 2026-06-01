# Iteration 81 — E4 优化建议芯片扩展

## 目标

主动补全增加：缺画面描述顾问、12–17 镜节奏顾问、断链一键「流程检查并修复」。

## 模块

- `hermesProactiveSuggestions.ts`
- `countSparseVisualPrompts`（`hermesPlanReasoning.ts`）

## 验收

1. 多镜空 visualPrompt → 芯片「顾问补全」
2. 检测到制片断链 → 芯片「检查并修复」
3. `npm run test -- hermesProactive` 通过

## 状态

✅ iter-81
