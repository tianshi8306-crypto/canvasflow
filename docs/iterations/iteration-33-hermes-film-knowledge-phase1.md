# 迭代 33 — Hermes 影视知识地基（阶段 1）

**层**：AssetAndQualityLayer + ProductionFlowLayer + ProviderOrchestrationLayer  
**周期**：约 1～3 个工作日（1 人）  
**母文档**：[`../product/HERMES_FILM_KNOWLEDGE.md`](../product/HERMES_FILM_KNOWLEDGE.md)

---

## 1) 本轮目标（一句话）

建立 **结构化影视知识库 + 本地检索**，并实现 **2 个可执行 Hermes Tool**：在画布上 **一键搭标准生产链路**、**分镜→Seedance 视频提示词回填**，使 Agent 从「答知识点」变为「能驱动画布」。

---

## 2) 变更范围（3 个模块）

| 模块 | 路径（计划） | 职责 |
|------|--------------|------|
| **A. Knowledge Pack & 索引** | `docs/hermes-knowledge/`、`src-tauri` `hermes_knowledge*`、`src/lib/hermes/knowledge/` | Markdown 分片、SQLite 索引、`hermes_knowledge_search` |
| **B. 流程拓扑** | `src/lib/hermes/film/filmWorkflowTopology.ts` | SOP → 节点布局 + 合法连线模板 |
| **C. Skill / Tool** | `hermesDirectorTypes`、`runHermesTool`、`hermesPlanFromIntent`、可选 `HERMES_SKILLS` | `film.create_standard_workflow`、`film.shot_to_video_prompt` |

---

## 3) 功能清单（4 项）

1. **知识文档（精简版）入库**：`sop/ai-short-drama-chain.md` + `models/seedance.md`（Markdown 规范写法，见 §6）。  
2. **本地检索**：`hermes_knowledge_search({ scene, query, limit })` → 返回 2～3 条片段（title、category、body、score）。  
3. **Tool `film.create_standard_workflow`**：按参数 `style`、`shotCount`、`totalDurationSec` 在画布创建 text→script→（建链占位）拓扑。  
4. **Tool `film.shot_to_video_prompt`**：读取主脚本 `storyboardShots`，按 Seedance 规则生成/写回 `videoNode` draft.prompt（需已建链）。

---

## 4) 非目标（本轮不做）

- Chroma / Pinecone / 独立向量服务进程。  
- 扫描 PDF、Word 自动入库（仅内置 MD；用户 docx 仍走 iter-32 剧本导入，**不进入 RAG**）。  
- 新建「策划节点」「剪辑节点」等 node type。  
- 全量 embedding 模型打包（阶段 1 默认 **SQLite FTS5** 关键词检索；embedding 列作为 **可选子任务**，见 §8）。  
- `film.workflow_check`、`batch_set_param`、排障库、风格库全集（阶段 2）。  
- Brain 流式对话默认每条都 RAG（仅 **Director 规划 / film Tool** 显式检索）。  
- 自动无人值守跑完全片。

---

## 5) 影视 SOP ↔ 画布（阶段 1 标准模板）

### 5.1 拓扑（`short_drama_v1`）

```text
[textNode: 大纲/需求]
        │ text
        ▼
[scriptNode: 脚本+分镜]
        │ script / 建链
        ├─► imageNode (per beat, Hermes chain 已有逻辑)
        └─► videoNode (per beat)
```

- **创建时**：`textNode` 写入用户 `brief`；`scriptNode` 带空 `scriptBeats` 或仅梗概；**不自动 LLM 解析**（除非用户另点「AI 解析」）。  
- **位置**：以当前视口中心为锚点水平排布，间距复用 `CANVAS_NODE_LAYOUT_GAP`。  
- **连线**：遵守 `flowConnectionPolicy`（text→script，script→image/video 由 `chain.spawn_media_nodes` 或模板内一次性建链）。

### 5.2 Tool 参数约定

**`film.create_standard_workflow`**

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `brief` | string | 用户原话摘要 | 写入 textNode.prompt |
| `style` | string | `"写实"` | 检索 creative/models 时用 |
| `shotCount` | number | `5` | 预生成 beat 占位数量（可选） |
| `totalDurationSec` | number | `30` | 写入 bible.targetDurationSec（若已有 bible store） |
| `spawnMedia` | boolean | `false` | true 时创建后立即 `chain.spawn_media_nodes` |

**`film.shot_to_video_prompt`**

| 参数 | 类型 | 说明 |
|------|------|------|
| `beatIds` | number[]? | 1-based，缺省全部有 visualPrompt 的镜 |
| `style` | string? | 覆盖默认风格检索 |

---

## 6) 知识文档清单（阶段 1 必写）

仓库路径：`docs/hermes-knowledge/`（构建时复制到 Tauri `resources/`，或运行时从 repo 相对路径读取）。

### 6.1 `sop/ai-short-drama-chain.md`（必写，≤120 行）

```markdown
---
id: sop-short-drama-v1
category: sop
tags: [短剧, 流程, 画布]
---

# 流程：AI 短剧标准生产链路

## 阶段1 需求与大纲
- 输入：主题、时长、风格
- 输出：textNode 大纲
- 下游：scriptNode

## 阶段2 脚本节点
…

## 阶段3 分镜
…

## 阶段4 文生图 / 图生视频
- 依赖：分镜 visualPrompt 就绪
- 工具：chain.spawn_media_nodes → image.generate → video.generate

## 画布拓扑规则
- 必须节点：textNode, scriptNode
- 推荐：每镜 imageNode + videoNode
```

### 6.2 `models/seedance.md`（必写，≤100 行）

```markdown
---
id: model-seedance-core
category: models
tags: [Seedance, 视频, 参数]
---

# Seedance 核心参数（CanvasFlow）

## 分辨率与时长
- 推荐：…
- 单镜上限：…（与代码 constants 对齐）

## 提示词结构
- 镜头描述 + 运镜 + 光影 + 风格词

## 避坑
- 抖动：运动强度不宜…
- 人物畸变：…

## 节点回填字段
- videoNode.data.video.draft.prompt
- params：modelId, duration, ratio …
```

撰写时 **对照** `src/lib/seedance/promptBuilder.ts`、`src/lib/videoNodeTypes.ts`，避免文档与代码冲突。

---

## 7) 技术方案

### 7.1 索引（阶段 1 默认：FTS5）

| 项 | 方案 |
|----|------|
| 分片 | 按 `##` 二级标题切 chunk，每 chunk ≤ 800 字，带 `doc_id`、`category`、`tags` |
| 存储 | `{app_data}/hermes-knowledge-index.sqlite` 全局索引 + 打开工程时无需重建；**或** 仅内置只读库随安装包 |
| 检索 | FTS5 `MATCH`，按 `scene` 过滤 category（`plan`→sop，`prompt`→models+creative，`troubleshoot`→troubleshoot） |
| 返回 | 最多 3 段，每段 ≤ 600 字符，附 `sourcePath` |

**Tauri 命令（草案）**

```rust
#[tauri::command]
fn hermes_knowledge_search(
    scene: String,      // "workflow" | "prompt" | "model" | "any"
    query: String,
    limit: Option<u8>,  // default 3
) -> Result<Vec<KnowledgeChunk>, String>

#[tauri::command]
fn hermes_knowledge_reindex() -> Result<ReindexStats, String>  // 开发/设置用
```

前端封装：`src/lib/hermes/knowledge/hermesKnowledgeSearch.ts`

### 7.2 Director 接入检索

- `fetchHermesLlmPlan` / `buildDirectorPlan`：当意图匹配「搭流程 / 短剧 / 制作视频」时，`situationSummary` 后追加 `## 检索知识\n...`。  
- 规则快路径：新增 `buildDirectorPlan` 分支 → 直接返回仅含 `film.create_standard_workflow` 的计划（零 LLM 延迟）。

### 7.3 Tool 实现要点

| Tool | 实现 |
|------|------|
| `film.create_standard_workflow` | `newNodeDataByType` + `addNodesWithEdges`；模板 ID `short_drama_v1` |
| `film.shot_to_video_prompt` | 读 `storyboardShots` + RAG(`scene=prompt`) + `buildSeedancePrompt` 或专用 `filmPromptFromShot`；`updateNodeData` 写 video draft |

注册：`hermesDirectorTypes.ts`、`hermesPlanLlm.ts` ALLOWED_TOOLS、`runHermesTool.ts` switch。

### 7.4 Skill 芯片（可选，建议做）

在 `hermesSkills.ts` 增加：

- `搭建短剧流程` → 预填「帮我搭建 30 秒短剧标准流程，5 个镜头，古风」  
- `分镜转视频提示词` → 预填「帮我把分镜转成 Seedance 视频提示词」

---

## 8) 实现顺序（建议按日）

### Day 1 — 知识与索引

| # | 任务 | 产出 |
|---|------|------|
| 1 | 创建 `docs/hermes-knowledge/` 两份 MD + frontmatter 规范 | 可被人工 review |
| 2 | Rust：`hermes_knowledge` 模块，解析 MD、写 FTS SQLite | `hermes_knowledge_reindex` |
| 3 | `hermes_knowledge_search` + 前端 invoke 封装 | 单元测试 2～3 条 |
| 4 | 设置页或 dev-only：「重建知识索引」按钮（可选） | 方便开发 |

### Day 2 — 拓扑 + Tool 1

| # | 任务 | 产出 |
|---|------|------|
| 5 | `filmWorkflowTopology.ts` + 测试 | `short_drama_v1` 节点坐标/边列表 |
| 6 | `film.create_standard_workflow` + `runHermesTool` | 画布可见 text+script |
| 7 | `hermesPlanFromIntent` 规则 + `HERMES_SKILLS` | 侧栏一句话出计划 |

### Day 3 — Tool 2 + 串联验收

| # | 任务 | 产出 |
|---|------|------|
| 8 | `film.shot_to_video_prompt`（依赖已有 chain） | video draft 有 prompt |
| 9 | Director 规划注入检索片段 | LLM 计划含 assumptions 引用 SOP |
| 10 | 手工验收 + `npm run quality:gate` 相关测试 | DoD |

### 可选拉伸（仍在阶段 1 内）

- SQLite 增加 `embedding BLOB` + 本地小模型/API embedding（仅当 FTS 召回不足时启用混合检索）。  
- Brain `hermes_chat_stream` 增加 `knowledgeScene: "any"` 参数。

---

## 9) 验收步骤（手工，Tauri 桌面端）

1. **检索**：Dev 控制台或临时按钮，搜索「Seedance 时长」→ 返回 `models/seedance.md` 片段 ≤3 条。  
2. **搭流程**：Hermes 输入「帮我做 30 秒古风短剧，5 个镜头」→ 确认计划 → 画布出现 textNode + scriptNode + 合法连线。  
3. **分镜 + 回填**：脚本已有 ≥1 条 `storyboardShots` 且已 `chain.spawn_media_nodes` → 执行 `film.shot_to_video_prompt` → 对应 `videoNode` draft.prompt 非空且含运镜/风格词。  
4. **知识不灌屏**：单次规划上下文检索片段总字符 < 2000（日志或 debug 面板可查）。  
5. **回退**：关闭 `film.*` tool 注册后，旧 Hermes「出图/导出」计划仍正常。

---

## 10) UI/UX

- **关键界面**：Hermes 侧栏（技能芯片、计划卡引用「依据：SOP/Seedance」一行）；画布新增节点位置不遮挡视口中心。  
- **关键状态**：检索 0 条 → Tool 仍可用但计划 assumptions 注明「未命中知识库」；建拓扑失败 → 计划步聚红 + statusText。  
- **本轮 UI 非目标**：不做独立「知识库浏览器」页；不做 Orb 新形态。

---

## 11) 风险与回滚

| 风险 | 缓解 |
|------|------|
| FTS 中文分词差 | 文档标题含中英文关键词；tags 冗余；阶段 2 再加 embedding |
| 拓扑与现有节点重叠 | 创建前检测是否已有 scriptNode，有则 **补连** 而非重复创建 |
| Seedance 文档与代码不一致 | §6.2 要求对照 `promptBuilder.ts` 编写；单测断言关键上限 |
| 安装包体积 | 阶段 1 仅 2 个 MD，< 50KB |

**回滚**：删除 `film.*` tool 注册与 `hermes_knowledge_*` 命令；保留 `docs/hermes-knowledge/` 无害。

---

## 12) 完成定义（DoD）

- [ ] 两份知识 MD 合入仓库并通过 `hermes_knowledge_reindex`  
- [ ] `hermes_knowledge_search` 有 Rust 测试或集成测试  
- [ ] 两个 `film.*` Tool 有 Vitest 纯函数测试（拓扑 / prompt 生成）  
- [ ] `hermesPlanFromIntent` 或规则可触发 `film.create_standard_workflow`  
- [ ] §9 五项手工验收通过  
- [ ] `CURRENT_PROGRESS.md` 指向本迭代  

---

## 13) 阶段 2 预告（不在本轮实现）

- 知识：`av-spec/`、`creative/` 风格库、`troubleshoot/`  
- Tool：`film.workflow_check`、`film.batch_set_video_params`  
- Brain 默认 RAG；排障案例写入工程记忆  
