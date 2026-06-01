# iter-104 · Hermes 版本指代 + 视频运镜锚 P4

**层级**：ProductionFlowLayer  
**前置**：iter-103

## 1) 本轮目标

「和上一版一样」恢复脚本快照中的画面/运镜；视频 Agent 成功后写入运镜风格锚。

## 2) 变更范围

- `hermesVersionReferent.ts`（新建）、`hermesWorkstate.ts`、`hermesScriptVersion.ts`
- `hermesStyleReferent.ts`、`hermesCanvasEventCache.ts`、`initHermesStyleAnchorRecording.ts`
- `hermesPlanFromIntent.ts`、`hermesSituation.ts`、`patchStoryboardShotTool.ts`
- `hermes_agent.rs`（Director 提示）

## 3) 功能清单

1. 脚本存档 ≥2 版时写入 `lastVersionStyleReferent`（上一版 visual + videoMotion）。
2. 用户说「和上一版一样/恢复上一版」→ 规则计划 `patch_shot` 直接写回快照字段（非 merge）。
3. `source: video_ready` 运镜锚：视频 Agent `end` 成功后更新 `lastStyleAnchor.videoMotionSnippet`。
4. Situation / workstate prompt 注入「上一版脚本快照」提示块。

## 4) 非目标

- 完整脚本版本 diff UI
- 自动无用户指令回滚
- 跨项目版本指代

## 5) 验收

1. 脚本保存第二版后 → workstate 含 `lastVersionStyleReferent.snapshots`。
2. 对 H 说「第 1 镜和上一版一样」→ 计划 `visualPrompt`/`videoMotionPrompt` 来自上一版快照。
3. 视频 Agent 成功 → `lastStyleAnchor.source` 为 `video_ready` 且含运镜 snippet。
4. `npm run test -- hermesVersionReferent hermesStyleReferent patchStoryboardShot`

## 6) UI/UX

本轮无 UI 变更。

## 7) 回退

移除 version referent 分支与 `video_ready` 录制；workstate 字段可保留（无害）。
