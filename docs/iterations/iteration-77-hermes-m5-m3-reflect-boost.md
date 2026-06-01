# Iteration 77 — M5 复盘 × M3 学习适应联动

## 目标

LLM 任务复盘结论绑定到 `[proc:]` 路径，提高 `pickBestLearnedProcedure` 与规划 prompt 中的权重。

## 功能

1. 成功 Job LLM 复盘写入 `[reflect-proc:toolId>…] lesson`
2. `scoreLearnedProcedureMatch` 对带复盘的路径 +5 分
3. `formatTopLearnedProceduresForPrompt` 展示「复盘：…」后缀

## 验收

1. 完成多步任务且开启 LLM 复盘 → memory 含 `[reflect-proc:…]`
2. 再次发送类似意图 → 规划倾向沿用同路径（learned / 补全）
3. `npm run test -- hermesLearningAdaptation` 通过

## 状态

✅ iter-77
