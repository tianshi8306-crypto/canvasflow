# iter-101 · Hermes 画布感知 P1（I2 深化）

**层级**：ProductionFlowLayer  
**前置**：iter-100（画布 → workstate → 指代 P0）

## 1) 本轮目标

多轮指代持久化、更多画布变更类型、聊天/规划上下文去重、Rust 顾问/规划/灵体提示对齐画布事实。

## 2) 变更范围

- `hermesCanvasReferent.ts`、`hermesWorkstate.ts`、`hermesCanvasEventCache.ts`
- `hermesReferentResolution.ts`、`hermesCanvasEvents.ts`、`initHermesCanvasAwareness.ts`
- `hermesSituation.ts`、`HermesSidebar.tsx`、`hermesDirector.ts`、`hermes_agent.rs`

## 3) 功能清单

1. `workstate.lastCanvasReferent`：选中/手改/计划步骤成功后写入，45 分钟内作「那镜/刚才」默认镜。
2. 新事件：`graph_changed`（节点/连线）、`brief_updated`（脚本梗概/标题）。
3. 聊天与 LLM 规划：`formatHermesSituationForLlm` 可省略画布块，由【工作记忆】统一提供，避免重复。
4. Director 步骤成功且含 `beatIds` → `persistCanvasReferent`。
5. Rust `GENERAL_ASSISTANT` / `DIRECTOR_PLAN` / `ORB_SUGGEST` 提示：优先读「近期画布变化」「对话指代默认镜」。

## 4) 非目标

- 会话级「按上面风格」跨镜风格克隆
- 画布 undo 栈 diff
- 无用户消息时自动发起 Agent Job

## 5) 验收

1. 手改镜 5 → 关闭侧栏再开 → 说「刚才那镜重出图」→ 计划 scope 镜 5（无显式镜号）。
2. 拖新连线 → workstate 出现 `graph_changed` 事件。
3. 侧栏聊天 situation 不重复两段「近期画布变化」，【工作记忆】仍有一段。
4. `npm run test -- hermesCanvasReferent hermesReferentResolution hermesCanvasEvents`

## 6) UI/UX

本轮无 UI 变更。

## 7) 回退

移除 `lastCanvasReferent` 字段与 `persistCanvasReferent`；恢复 `formatHermesSituationForLlm` 无 options 默认行为。
