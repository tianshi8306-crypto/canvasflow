# iter-102 · Hermes 风格指代 + 梗概变更灵体跟进

**层级**：ProductionFlowLayer（I1/I2）  
**前置**：iter-101

## 1) 本轮目标

支持「按上面/同样风格」跨镜套用；梗概更新后灵体主动建议检查分镜。

## 2) 变更范围

- `hermesStyleReferent.ts`、`hermesWorkstate.ts`、`hermesCanvasEventCache.ts`
- `hermesPlanFromIntent.ts`、`patchStoryboardShotTool.ts`
- `hermesProactiveSuggestions.ts`、`hermes_agent.rs`

## 3) 功能清单

1. `lastStyleAnchor`：分镜 visual 手改 / 圣经 visualStyle 写入 workstate。
2. 规则计划：「第 N 镜按上面风格出图」→ `patch_shot` + `styleReferenceShot`/`styleReferenceSnippet`。
3. patch 工具：将参考镜 visual 融入目标镜文案，可选 regenerateImage。
4. 灵体：`brief_updated` →「检查分镜」建议（LLM 增强）。
5. LLM 摘要/workstate 含「风格参考锚点」行。

## 4) 非目标

- 自动跨镜复制 Seedance 参数
- 无用户操作自动跑 Director
- 图像 embedding 相似度匹配

## 5) 验收

1. 改镜 3 分镜为「水墨国风」→ 对 H 说「第 2 镜按上面风格出图」→ 计划含 patch_shot + beatIds [2]。
2. 改脚本梗概 → 灵体出现「梗概刚更新，检查分镜」。
3. `npm run test -- hermesStyleReferent hermesPlanFromIntent patchStoryboardShot`

## 6) UI/UX

本轮无 UI 变更。

## 7) 回退

移除 `lastStyleAnchor` 与 style clone 计划分支；删除 patch 工具 styleReference 参数。
