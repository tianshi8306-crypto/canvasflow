# iter-103 · Hermes 风格指代 P3

**层级**：ProductionFlowLayer  
**前置**：iter-102

## 1) 本轮目标

关键帧成功后写入风格锚点；无镜号时批量「按上面风格出图」。

## 2) 变更范围

- `hermesStyleReferent.ts`、`hermesCanvasEventCache.ts`、`initHermesStyleAnchorRecording.ts`
- `hermesPlanFromIntent.ts`、`patchStoryboardShotTool.ts`、`runHermesTool.ts`
- `hermes/index.ts`（初始化）

## 3) 功能清单

1. `source: image_ready` 风格锚：图片 Agent `commit/end` 成功后写入 workstate。
2. patch / 批量出图提交成功后同步更新锚点（首镜 beat）。
3. `pickStyleCloneBatchShotNumbers`：无镜号 + 风格指代 → 缺关键帧镜（排除参考镜），最多 8 镜。
4. 规则计划标题「批量风格套用」，单步 `patch_shot` 多 beatIds。

## 4) 非目标

- 图像 embedding 相似度
- 自动无用户指令跑 Director
- 视频成片风格迁移

## 5) 验收

1. 镜 1 出图成功 → workstate `lastStyleAnchor.source` 为 `image_ready`。
2. 对 H 说「按上面风格出图」（不写镜号，且 2/3 镜缺图）→ 计划 beatIds `[2,3]`。
3. `npm run test -- hermesStyleReferent patchStoryboardShot`

## 6) UI/UX

本轮无 UI 变更。

## 7) 回退

移除 `initHermesStyleAnchorRecording` 与 batch 风格分支；`image_ready` 解析回退为仅 storyboard/bible。
