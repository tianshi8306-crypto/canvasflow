# Iteration 54 — NL 增量编辑（patch_shot）

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §3.3 E1 · P1

## 1) 目标

「第 3 镜改成夜景」「3号镜：雨夜霓虹再出图」等口语稳定映射为 `storyboard.patch_shot` 结构化参数；LLM 计划缺字段时用用户原文补全。

## 2) 范围（3 模块）

- `hermesNlPatch.ts` — 镜号/画面/运镜/构图/负向/重出图视频解析
- `hermesPlanFromIntent.ts` + `patchStoryboardShotTool.ts` — 规则规划与执行
- `runHermesTool.ts` — LLM 步骤 enrich

## 3) 功能

1. 扩展镜号：`3号镜`、`镜号3`
2. 画面提取：`改成`、`第 N 镜：`、视觉描述行
3. 构图/负向/运镜提示词字段
4. `enrichPatchStepFromMessage` 补全 LLM 步骤 args

## 4) 非目标

- 选中节点指代「这镜」（需 selection 上下文，后续 iter）
- 标题/UI 改色等非分镜字段

## 5) 验收

1. 「3号镜改成夜景再出图」→ 单步 patch + regenerateImage
2. 「第 1 镜构图改为特写，不要出现文字」→ composition + negative
3. LLM 只返回 patch_shot + beatIds → 执行时仍写入 visualPrompt
4. `npm run test -- hermesNlPatch` 通过

## 6) 状态

✅ 已实现（iter-54）
