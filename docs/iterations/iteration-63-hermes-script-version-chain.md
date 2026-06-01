# Iteration 63 — E2 脚本/分镜版本链

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §3.3 E2 · P2

## 1) 目标

Agent 改脚本/分镜后自动快照；用户可列出、对比、回滚到历史版本（工程级 `.canvasflow/hermes/script-versions.json`）。

## 2) 范围

- `hermesScriptVersion.ts` — 存取、回滚、diff 摘要
- `runHermesTool` — 写脚本 tool 成功后存档
- `hermesAgentChat` — 话术：列版本 / 保存 / 回滚 / 对比

## 3) 功能

1. 自动快照：`update_brief` / `generate_outline` / `generate_storyboard` / `patch_shot` 成功后
2. 「脚本版本」「保存脚本快照」「回滚脚本」「版本对比」
3. 回滚默认上一存档；可带 `sv-xxx` id 前缀
4. 最多保留 24 条

## 4) 非目标

- ~~可视化 diff UI~~（见 iter-67）、分支合并
- 非脚本节点版本

## 5) 验收

1. Agent 生成分镜后 `script-versions.json` 新增条目
2. 「列出脚本版本」显示 id / 时间 / 镜数
3. 「回滚脚本」恢复上一版 beats/shots
4. 单测通过

## 6) 状态

✅ 已实现（iter-63 / P2-E2）
