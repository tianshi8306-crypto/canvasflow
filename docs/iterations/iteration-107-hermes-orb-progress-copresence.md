# iter-107 · Hermes Orb 进度共感

**层级**：CanvasExperienceLayer  
**前置**：iter-110 Ambient 任务轨

## 1) 本轮目标

不打开浮窗也能从 Orb 感知灵体状态：四态光晕 + hover 两条任务摘要 + 失败一键看详情。

## 2) 变更范围

- `hermesOrbActivity.ts`、`hermesShellActivityStore.ts`
- `HermesOrbProgressPeek.tsx`、`HermesOrb.tsx`
- `HermesSidebar.tsx`（planning/streaming 提升到 store）
- `hermes-shell.css`

## 3) 功能清单

1. **Orb 状态机**：`idle` / `planning` / `running` / `failed`（失败 > 规划 > 执行）。
2. **Hover 摘要**：悬停 Orb 显示最多 2 条最近活跃任务（计划标题 + 状态）。
3. **失败 pinned peek**：有失败 Job 时固定展示摘要条 +「看详情」（开任务抽屉）+「打开对话」。
4. **planning/streaming 全局化**：浮窗收起后 Orb 仍可显示「规划步骤」态。

## 4) 非目标

- Orb 旁常驻 ambient chip（iter-110 已改为 hover/pinned peek）
- 完整待办树 / 费用预估
- iter-112 规划期 execute 排队

## 5) 验收

1. 下制片指令且浮窗收起 → Orb  cyan 脉冲（running）。
2. 发送复杂 execute 指令规划时 → Orb  amber 脉冲（planning），hover 见「正在分析…」。
3. Job 失败 → Orb 红色脉冲 + pinned peek「看详情」→ 打开任务抽屉。
4. Hover running → 见 2 条以内任务摘要。
5. `npm run test -- hermesOrbActivity hermesOrb`

## 6) UI/UX

- 动效 ≤300ms（peek 220ms）；`prefers-reduced-motion` 关闭 pulse。
- peek 不挡 Orb 拖拽（拖拽时隐藏）。
- 建议气泡优先级高于 progress peek。

## 7) 回退

移除 `HermesOrbProgressPeek` 与 activity class；Sidebar 恢复本地 planning state。
