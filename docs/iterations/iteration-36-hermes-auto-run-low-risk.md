# Iteration 36 — Hermes 低风险步骤自动执行

- **层**：ProductionFlowLayer
- **目标**：设置开启后，Director 计划**头部连续低风险步骤**自动执行，其余步骤仍显示确认卡片。

## 模块

| 模块 | 变更 |
|------|------|
| `hermesDirectorPrefs.ts` | `autoRunLowRisk` localStorage |
| `hermesLowRiskTools.ts` | 判定 + `splitPlanForAutoRun` |
| `SettingsPanel.tsx` | Hermes 导演开关 |
| `HermesSidebar.tsx` | 规划后自动跑前缀步骤 |

## 低风险定义

| 工具 | 条件 |
|------|------|
| `script.update_brief` | 始终 |
| `canvas.focus` | 始终 |
| `bible.update` | 始终 |
| `storyboard.patch_shot` | 无 `regenerateImage` / `regenerateVideo` |

## 验收

1. 设置开启，说「定位第 1 镜」→ 自动执行，无待确认卡片
2. 说「第 1 镜改成雨夜再出图」→ 仅改词自动；出图步骤留在确认卡片
3. 设置关闭 → 行为与原先一致（全部待确认）

## 回滚

关闭默认 `autoRunLowRisk: false` 或移除 Sidebar 分流逻辑。
