# iter-105 · Hermes 运镜指代 + 分镜改后视频灵体 P5

**层级**：ProductionFlowLayer（I1/I2）  
**前置**：iter-104

## 1) 本轮目标

「按上面运镜」跨镜套用 videoMotion；仅运镜锚点可被识别；分镜手改且已有成片时灵体建议重出视频。

## 2) 变更范围

- `hermesStyleReferent.ts`、`storyboardMediaNodes.ts`
- `hermesPlanFromIntent.ts`、`hermesCanvasEvents.ts`
- `hermesProactiveSuggestions.ts`、`hermesProactivePolicy.ts`
- `hermes_agent.rs`

## 3) 功能清单

1. `messageHasMotionReferent` + `pickMotionCloneBatchShotNumbers`：无镜号时优先缺成片镜，最多 8 镜。
2. 规则计划「运镜套用」→ `patch_shot` 写 `videoMotionPrompt`，按需 `regenerateVideo`。
3. `isStyleAnchorFresh` 支持仅含 `videoMotionSnippet` 的 `video_ready` 锚。
4. `shotEditedWithVideoEvent` → 灵体「分镜已改，成片可能过时」建议重出视频。
5. Rust Director 规则第 12 条：运镜指代优先 patch_shot。

## 4) 非目标

- Seedance 运镜预设参数自动同步
- 自动无用户指令批量出视频
- 运镜 embedding 相似度

## 5) 验收

1. 镜 1 视频成功 → workstate 锚含运镜 → 对 H 说「第 2 镜按上面运镜」→ 计划写镜 2 的 videoMotionPrompt。
2. 镜 2/3 缺视频 →「按上面运镜出视频」（无镜号）→ beatIds `[2,3]`。
3. 手改已有成片的分镜 → 灵体出现「重新出视频」建议。
4. `npm run test -- hermesStyleReferent patchStoryboardShot hermesCanvasEvents`

## 6) UI/UX

本轮无 UI 变更。

## 7) 回退

移除 motion referent 计划分支与 `shot_edited_regen_video` 建议；`isStyleAnchorFresh` 可保留扩展（无害）。
