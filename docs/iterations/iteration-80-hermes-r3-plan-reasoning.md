# Iteration 80 — R3 计划逻辑补全

## 目标

LLM/规则计划缺依赖时，按画布状态自动插入前置步骤（分镜→出图→视频→导出检查）。

## 模块

- `hermesPlanReasoning.ts` — `completePlanWithLogicalSteps`
- `hermesDirector.ts` — `finalizeDirectorPlan` 统一 M3+M5 后推理

## 验收

1. 仅「批量出视频」且缺分镜 → 计划前自动加 `script.generate_storyboard`
2. 仅「导出」且未就绪 → 前插 `film.workflow_check`
3. `npm run test -- hermesPlanReasoning` 通过

## 状态

✅ iter-80
