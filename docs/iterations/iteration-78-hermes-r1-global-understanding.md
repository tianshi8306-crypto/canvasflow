# Iteration 78 — R1 全局理解增强

## 目标

为 Director / LLM 与侧栏 Situation 提供 **全片阶段、进度%、瓶颈、建议下一步**。

## 模块

- `hermesGlobalUnderstanding.ts` — `inferHermesPipelinePhase`、`formatHermesGlobalUnderstandingForLlm`
- `formatHermesSituationForLlm` — 注入【全片理解】块
- `HermesSituationCard` — 展示 `阶段 · N%`

## 验收

1. 有脚本+分镜时侧栏 headline 含「关键帧出图 · xx%」类前缀
2. Director 上下文含【全片理解】与「建议下一步」
3. `npm run test -- hermesGlobalUnderstanding hermesSituation` 通过

## 状态

✅ iter-78
