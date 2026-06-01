# 迭代 23 — Hermes 对话编排（Director，无 @）

**层**：ProductionFlowLayer  
**核心目标**：用户与灵体/侧栏**纯自然语言**沟通创意；Hermes 根据对话与画布状态**自动规划并调用**现有节点 Agent / Chain 执行生成，**不需要 @ 引用**。

## 用户故事

> 文字：「我想创作一个关于未来城市的科幻短剧」→ 多轮碰撞 → 「出大纲」→ 「做分镜并出关键帧」→ 「第 2 镜参考上传的霓虹图」→ 「合成导出」。  
> 详见 [`HERMES_CREATIVE_WORKFLOW.md`](../product/HERMES_CREATIVE_WORKFLOW.md)。

> 短路径：「30 秒古风短片，雨夜女主回头」→ 建 script → 分镜 → 建链出图 → 单镜修改重出。

## 架构：四层

```
对话（Shell）→ Director（规划）→ Executor（现有能力）→ 画布 SSOT
                  ↑                    │
                  └──── 资产卡 + 执行结果 ─┘
```

| 层 | 职责 | 实现复用 |
|----|------|----------|
| **Shell** | 灵体/侧栏、流式对话、计划卡片 UI | Phase A/B ✅ |
| **Director** | 意图识别、多步计划、确认策略 | 新 `hermesDirector.ts` |
| **Executor** | 真正改画布、调 API | `runNodeTaskAgent`、Hermes Chain、`scriptStoryboardGenerateAgentRuntime` 等 |
| **Chain** | 分镜后批量建节点/出图 | `autoChain.ts`（作为 Executor 一步） |

## Director 工具集（首批，均需用户确认后执行）

| 工具 id | 何时调用 | 底层 |
|---------|----------|------|
| `canvas.ensure_script` | 无 scriptNode 且用户要开始成片 | 创建 scriptNode + 连线 |
| `script.update_brief` | 用户描述创意/改梗概 | 写 `scriptNode.data.prompt` |
| `script.generate_storyboard` | 剧本就绪要分镜 | `scriptStoryboardGenerateAgentRuntime` |
| `chain.spawn_media_nodes` | 分镜已就绪要下游节点 | `handleScriptNodeCompleted` |
| `image.generate_for_beats` | 用户要出图（可指定镜号） | `batchGenerateImages` / 单镜 Agent |
| `video.generate_for_beats` | 用户要出视频 | `videoGenerationAgentRuntime` |
| `canvas.summarize` | 仅问答、不生成 | 只读资产卡回复 |

**不做的工具（v1）**：自动删节点、自动改工程路径、无人值守跑完全片。

## 对话 → 执行策略

1. **每轮**：LLM 输出 `{ reply, plan?: Step[] }` 或 function calling 等价物。  
2. **plan 非空**：侧栏展示「即将执行」清单（中文），默认 **[执行计划]** / **仅聊天**。  
3. **执行**：按 DAG 顺序跑 Executor；每步更新状态栏 + 对话里插入进度条消息。  
4. **失败**：该步停止，Hermes 用失败原因 + 建议（如即梦登录）继续对话，不静默重试。  
5. **记忆**：对话历史 + 画布资产卡；**不**用 @；镜号/节点由 Director 从 `storyboardShots` / `scriptBeatId` 解析。

## 与 @ 的关系

- **不做** Shell 内 `@画布节点`。  
- **计划做（Phase D）** 会话内 `@参考素材`（已上传至 `assets/`）。  
- 视频节点 Seedance `@图1` 保留在节点 prompt，由工具写入，非 Hermes 主输入。

## 模块（预估 3）

1. `src/lib/hermes/hermesDirector.ts` — 计划解析、工具注册、执行队列  
2. `src/lib/hermes/hermesTools/` — 各工具适配现有 Agent  
3. `HermesSidebar.tsx` — 计划确认 UI、执行态

Rust（可选 Phase 23b）：`hermes_plan` 单次 JSON 规划调用；执行仍在前端（便于复用 `projectStore`）。

## 功能点（迭代 23 最小可验收）

1. 用户说「帮我把当前项目分镜出图」→ 弹出计划（查 script、就绪镜、Chain/批量出图）→ 确认后执行  
2. 执行过程在对话流显示步骤状态（成功/失败）  
3. 无 scriptNode 时计划第一步为「创建脚本节点」，不静默失败  
4. 全程无 @；无新端口  

## 非目标

- 自动执行无需确认（可设置页开关，默认关）  
- 复杂多集工程结构  
- LLM 流式 tool_calls（v1 用「先规划 JSON → 再执行」两阶段即可）

## 手工验收

1. 打开有 script+分镜的工程，对 Hermes 说「给已就绪的分镜出图」→ 见计划 → 确认 → 画布出现生成任务  
2. 说「只出第 1 镜」→ 计划仅含 1 镜  
3. 点「仅聊天」→ 不改画布  
4. 无 API Key → 计划或执行前提示，不白屏  

## 回滚

- 关闭 Director，保留 Phase B 纯对话

## 依赖

- Phase B ✅  
- 工程已打开（`projectPath`）  
- iteration-13 Chain 策略（可合并为计划一步）
