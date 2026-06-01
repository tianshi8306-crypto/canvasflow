# Iteration 69 — I3 主动补全持续打磨

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §3.1 I3 · P1 持续

## 1) 目标

在 iter-57/64 基础上减少侧栏重复、补齐缺口话术、增强断点/排队感知，发送后自动忽略已采纳建议。

## 2) 范围（3 模块）

- `hermesProactiveSuggestions.ts` — 去重过滤、忽略别名、断点/排队规则
- `hermesSituation.ts` — `bible_no_refs` / `export_not_ready` 可执行话术
- `HermesSidebar.tsx` — 芯片与 Situation 分工、发送后 dismiss

## 3) 功能

1. `filterSidebarProactiveChips`：Situation 待办已展示时，芯片不再重复同源 gap
2. `expandProactiveDismissIds` / `isProactiveSuggestionDismissed`：× 与 Orb 忽略同步别名 id
3. 未跑完制片计划 → `pipeline_checkpoint_resume`（「继续跑片」）
4. 制片排队 ≥2 → `director_jobs_queued` 顾问芯片
5. 点击芯片发送后自动忽略该建议（仍可手动 ×）
6. gap：`bible_no_refs`、`export_not_ready` 补 `suggestedPrompt`

## 4) 非目标

- 点击芯片自动执行计划
- 侧栏与 Orb 共用同一 sessionStorage 键（仍分键，仅忽略别名对齐）

## 5) 验收

1. 有脚本无分镜：Situation 显示「生成分镜」待办，芯片区不再出现同文案「还缺 N 镜分镜」
2. 点击芯片预填并发送 → 该建议本会话不再出现
3. localStorage 有未完成 pipeline 断点 → 出现「继续跑片」芯片
4. × 忽略 `gap_storyboard_missing` 后，`storyboard_missing` 也不再出现（Orb 同理）
5. `npm run test -- hermesProactive` 通过

## 6) 状态

✅ 已实现（iter-69 / I3 打磨）
