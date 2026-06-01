# Iteration 76 — E1 增量编辑扩展（梗概 / 圣经）

> 真源：HERMES_CURSOR_AGENT_SPEC §3.3 E1

## 目标

除 `patch_shot` 外，口语可增量更新 **脚本梗概** 与 **项目圣经字段**（画风、logline、禁忌、时长）。

## 模块

- `hermesNlEdit.ts` — 解析 + `enrichBriefStep` / `enrichBibleStep`
- `hermesPlanFromIntent` — 规则计划快路径
- `runHermesTool` — 执行前 NL 补全 args

## 验收

1. 「梗概改成：…」→ `script.update_brief`
2. 「画风改成赛博」→ `bible.update`（无需说「圣经」）
3. `npm run test -- hermesNlEdit` 通过

## 状态

✅ iter-76
