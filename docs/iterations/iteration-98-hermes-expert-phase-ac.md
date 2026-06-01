# iter-98 · Hermes 专家路线阶段 A/C

**层级**：ProductionFlowLayer  
**前置**：iter-97（灵体 LLM 建议 + 侧栏过滤）、专家教义 + 画布 RAG

## 1) 本轮目标

补齐 L1 知识库与启动索引（阶段 A），并实现灵体对失败/续跑的主动执行（阶段 C）。

## 2) 变更范围

- `docs/hermes-knowledge/` + `src-tauri/resources/hermes-knowledge/`
- `initHermesKnowledge.ts`、`hermes/index.ts`
- `hermesProactivePolicy`（`ORB_PROACTIVE_AUTO_ACT_IDS`）
- `hermesOrbProactiveAct.ts`、`HermesOrbSuggestionBridge.tsx`
- `hermesAgentSettings` + `SettingsAgentSection`（`agentProactiveRecovery`）

## 3) 功能清单

1. 新增排障/平台画幅知识条目；应用启动每会话 `hermesKnowledgeReindex` 一次。
2. 设置项「灵体自动处理失败与续跑」：与「自动执行制片操作」联动，默认关。
3. 开启后，灵体恢复类建议稳定 1.5s 后自动展开 H 并提交 `actionPrompt`（同会话同建议去重）。
4. 不自动执行跃迁推销类（如 `storyboard_complete_chain`、`images_ready_video`）。

## 4) 非目标

- 阶段 D（按项目类型学 Skills / 成功经验自动沉淀）— 仍依赖既有 `agentPostJobLlmReflect`
- 侧栏芯片自动执行
- Rust settings 持久化新字段（走前端 `save_settings` JSON 合并）

## 5) 验收

1. 重启应用 → 控制台或调试可见 knowledge reindex（仅首次会话）。
2. 设置开启「灵体自动处理失败与续跑」+「自动执行」→ 制造视频失败 → 灵体建议后 H 自动提交重试计划。
3. 关闭该设置 → 仅预填/点击执行，不自动发送。
4. `npm run test -- hermesOrbProactiveAct hermesProactivePolicy`

## 6) UI/UX

- **设置 → Agent**：新开关 + 说明（API 消耗、依赖自动执行）
- **灵体**：自动执行前仍可先显示规则/LLM 文案约 1.5s

## 7) 回退

- 关 `agentProactiveRecovery`；移除 Bridge 自动执行 effect 与事件监听。

## 8) 后续（阶段 D）

- 恢复成功后写入工程记忆摘要；按广告/短剧/单镜模板加载 Skills。
