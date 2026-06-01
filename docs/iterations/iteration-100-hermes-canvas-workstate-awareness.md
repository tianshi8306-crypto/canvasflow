# iter-100 · Hermes 画布感知 → workstate → 规划/指代

**层级**：ProductionFlowLayer（I2 画布 workstate 闭环）  
**前置**：iter-97～99（灵体 LLM、专家层、记忆/Skills）

## 1) 本轮目标

画布手改/选中/媒体节点变更写入 workstate，LLM 制片摘要带近期画布事件；用户说「那镜/刚才」可解析到最近编辑或选中镜号。

## 2) 变更范围

- `initHermesCanvasAwareness.ts`、`hermesCanvasEvents.ts`、`hermesWorkstate.ts`
- `hermesReferentResolution.ts`、`hermesSituation.ts`
- `hermesPlanFromIntent.ts`、`toolBeatIds.ts`、`hermesNlPatch.ts`

## 3) 功能清单

1. 任意画布事件 ingest 后 debounce 刷新 workstate 内存缓存。
2. `formatHermesSituationForLlm` 附加「近期画布变化」块（来自事件缓存）。
3. 媒体节点 prompt/素材变更 → `structure_changed` 事件。
4. `resolveHermesShotNumbers`：指代词回落近期 `storyboard_edited`/`selection_focused` 或当前选中镜。
5. Job 同步 workstate 时保留 `recentCanvasEvents`。

## 4) 非目标

- 全量节点 data diff（除脚本/媒体指纹外）
- Rust Agent 侧独立指代解析
- 灵体 UI 新面板

## 5) 验收

1. 改分镜 visualPrompt → `.canvasflow/hermes/workstate.json` 的 `recentCanvasEvents` 增加记录。
2. 选中镜 3 后对话「把这镜重新出图」→ 规则计划 scope 为镜 3。
3. Hermes 侧栏 LLM 规划/灵体建议的 situation 含「近期画布变化」行。
4. `npm run test -- hermesReferentResolution hermesCanvasEvents hermesSituation`

## 6) UI/UX

本轮无 UI 变更（行为在 Hermes 规划与 workstate 层）。

## 7) 回退

移除 `formatCachedCanvasEventsForPrompt` 注入；恢复仅 scriptChanged 时 refresh workstate；删除 `hermesReferentResolution.ts` 并还原 `parseShotNumbersFromMessage` 直调。
