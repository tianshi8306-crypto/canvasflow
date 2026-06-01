# Iteration 57 — I3 主动补全增强

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §3.1 I3 · P1

## 1) 目标

缺分镜/缺图/失败镜等场景：侧栏与灵体给出可点击的下一步建议，一键预填 Hermes 输入框（不自动执行）。

## 2) 范围（3 模块）

- `hermesProactiveSuggestions.ts` — 统一建议引擎（Orb + 侧栏）
- `HermesProactiveChips` + `HermesSituationCard` — 侧栏 UI
- `HermesSidebar` — 输入区上方展示

## 3) 功能

1. `buildHermesProactiveSuggestions`：gaps + 制片跃迁 + 失败任务，最多 4 条
2. 侧栏「建议下一步」芯片（预填话术，× 忽略）
3. Situation 待办行可点「执行」预填
4. Orb 仍显示最高优先级单条（同源逻辑）
5. `storyboard_failed` gap 补 `suggestedPrompt`

## 4) 非目标

- 点击芯片自动跑计划（需用户发送）
- 全屏引导/wizard

## 5) 验收

1. 有脚本无分镜 → 侧栏出现「生成分镜」芯片，点击后输入框有「帮我把脚本生成分镜」
2. 视频失败 → 芯片/Orb 建议重试
3. × 忽略后本会话不再显示该 id
4. `npm run test -- hermesProactive` 通过

## 6) 状态

✅ 已实现（iter-57 / I3）
