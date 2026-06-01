# iter-97 · Hermes 灵体建议 LLM 增强 + 侧栏 Situation 过滤

**层级**：ProductionFlowLayer（制片感知 / Hermes 主动建议）  
**关联**：iter-79（E3 制片 issue）、iter-81（顾问芯片）、iter-78（R1 全片理解）

## 1) 本轮目标（一句话）

高价值场景下，灵体气泡建议由轻量 LLM 改写为制片专家口吻；侧栏 Situation 卡与灵体一致，不再展示「缺关键帧」等稳态催促。

## 2) 变更范围（最多 3 个模块）

- **策略**：`hermesProactivePolicy.ts`（`ORB_LLM_ENHANCE_*`、`filterGapsForSituationCard`）
- **后端**：`hermes_agent::suggest_orb`、`hermes_orb_suggest` Tauri 命令
- **前端**：`hermesOrbSuggestLlm.ts`、`hermesOrbSuggestStore.ts`、`HermesSidebar` + `hermesSituation` headline

## 3) 功能清单

1. 规则命中 `video_failed` / 跃迁 / 断链等 id 时，先展示规则文案，再异步调用 `hermes_orb_suggest` 合并 JSON（失败回退规则）。
2. 注入制片状态、专家教义、知识库 RAG；不改动 `id` / `severity`。
3. 侧栏 `HermesSituationCard` 使用 `filterGapsForSituationCard`，与 `PROACTIVE_EXCLUDED_GAP_IDS` 对齐。
4. Headline 不再强调「缺 N 镜关键帧」；LLM/对话上下文仍保留完整 `situation.gaps`。

## 4) 非目标

- 不恢复「缺脚本节点」类灵体/侧栏 nag
- 不新增流式 orb UI；不做侧栏 chips 的 LLM 改写
- 不改 Director 计划主路径

## 5) 验收步骤

1. 打开工程，配置对话 Provider；制造 1 镜视频失败 → 灵体气泡先出规则文案，约 1–2s 后变为更具体中文（含镜号/重试意图）。
2. 断网或未配置 Key → 始终保留规则文案，无报错阻塞。
3. 有分镜、无关键帧 → 侧栏 Situation **不**出现「还缺 N 镜关键帧」行；headline 为「N 镜分镜就绪」类中性描述。
4. 视频失败 → 侧栏仍显示失败行，芯片不与 Situation 重复同源 gap。
5. `npm run test -- hermesOrbSuggestLlm hermesProactivePolicy hermesSituation`

## 6) UI/UX

- **关键界面**：画布灵体气泡、Hermes 侧栏 Situation 卡
- **关键状态**：规则文案 → LLM 增强替换；无 Provider 时仅规则
- **本轮 UI 非目标**：不改气泡定位/拖拽（iter 前序已做）

## 7) 风险与回退

- **风险**：LLM 延迟导致文案闪烁；偶发 JSON 解析失败
- **触发**：气泡长期空白、actionPrompt 与规则意图偏离、侧栏仍大量缺图催促
- **回退**：移除 `hermes_orb_suggest` 注册与 store 中 `enhanceOrbSuggestionWithLlm` 调用；侧栏回退为 `situation.gaps` 全量展示

## 8) 完成定义

- [x] 上述验收 1–5 通过
- [x] `cargo check` 与相关 vitest 通过
