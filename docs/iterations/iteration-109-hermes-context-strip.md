# iter-109 · 短句 Situation（ContextStrip） ✅

**层级**：CanvasExperienceLayer  
**前置**：iter-108 画布高亮 + 选中 ack  
**状态**：已实现

## 1) 本轮目标

浮窗 composer 上方用 **一行 ContextStrip** 展示阶段 + 制片短句；**不再**在 composer 区 inline 展示 Situation 待办列表（待办改由工具抽屉内 proactive 芯片承接）。

## 2) 变更范围

- `hermesContextStrip.ts`、`HermesContextStrip.tsx`
- `HermesSidebar.tsx`（float vs chatOnly 分工）
- `hermes-shell.css`（`.hermesContextStrip`）

## 3) 功能清单

1. **短句**：`阶段 · N% — headline`，最长 96 字省略。
2. **tone**：block/warn gap → 条形色；neutral 为灰字。
3. **float**：footer 固定 ContextStrip；SituationCard 仅出现在 chatOnly 侧栏 / 工具抽屉外。
4. **芯片去重**：float 无 inline 待办卡 → proactive 芯片恢复展示 gap 类建议。

## 4) 非目标

- 改 LLM situation 注入格式
- Orb peek / 任务抽屉
- chatOnly 侧栏移除 HermesSituationCard

## 5) 验收

1. 打开工程、浮窗收起 → composer 上方 **一行** 短句，无 gap 列表。
2. 有 warn/block 缺口 → 条带黄/红色，文案仍为单行。
3. 选中节点 → composerStatus 仍显示「已注意到选中…」（4s），与 strip 并存。
4. 工具抽屉内 proactive 芯片仍可对 gap 预填执行。
5. `npm run test -- hermesContextStrip hermesPhase0`

## 6) UI/UX

- 11px secondary 字；ellipsis 不撑高浮窗。
- 与 `hermesSelectionAck` 灰字区分；warn/block 仅 strip tone。

## 7) 回退

移除 ContextStrip；float composer 恢复 inline `HermesSituationCard`。
