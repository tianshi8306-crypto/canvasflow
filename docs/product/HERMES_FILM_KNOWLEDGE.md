# Hermes 影视知识架构（产品真源）

> **定位**：Hermes 不是「聊天百科」，而是 **自然语言 → 检索行业知识 → 操作画布 → 调度生成** 的影视生产 Agent。  
> **阶段 1 执行单**：[`../iterations/iteration-33-hermes-film-knowledge-phase1.md`](../iterations/iteration-33-hermes-film-knowledge-phase1.md)

---

## 1. 四类行业内容（存什么）

| 知识域 | 目录（内置） | Agent 用途 |
|--------|--------------|------------|
| **全流程 SOP** | `hermes-knowledge/sop/` | 搭拓扑、校验依赖、补全断链 |
| **模型 & 参数** | `hermes-knowledge/models/`（含 `seedance.md`） | 填 video/image 节点 params、时长上限 |
| **音视频规范** | `hermes-knowledge/av-spec/` | 导出、码率、平台适配（阶段 2 加重） |
| **创意 & 镜头语言** | `hermes-knowledge/creative/` | 分镜/出图；`video-character-motion-prompt.md`（图生视频人物动作）；TTS 表演 |
| **从业者技巧（非官方）** | `creative/` + `practices/README.md` | 社区实测写法（如 TTS 四层表演模板）；**人工审校入库，不爬站** |
| **排障 & 经验** | `hermes-knowledge/troubleshoot/` | 诊断与修复技能（阶段 2 加重） |

**格式**：仅 Markdown（标题 / 列表 / 表格）；禁止扫描 PDF 进 RAG。第三方站点技巧须提炼为短文档并标注 `source: community-practice`。  
**原则**：文档存 **规则与标准**；**建节点、改参数、跑任务** 一律走 Hermes Tool。

---

## 2. 四类能力形态（怎么用）

| 能力形态 | 实现载体 | 阶段 1 |
|----------|----------|--------|
| **知识结构化** | 分片 + 本地索引（SQLite） | ✅ 索引 + 检索 API |
| **流程节点化** | SOP → `FilmWorkflowTopology` → 画布 nodes/edges | ✅ 标准短剧链路模板 |
| **能力技能化** | `HERMES_SKILLS` + `HermesToolId` 注册 | ✅ 2 个 film.* Tool |
| **动作可执行化** | `runHermesTool` + assess 预检 | ✅ 接 projectStore |

---

## 3. 与现有 Hermes 子系统关系

```text
用户指令
  → Shell（侧栏/灵体）
  → [NEW] hermesKnowledgeSearch(scene, query)   ← 阶段 1
  → Director（规则/LLM 计划，含 film.* tools）
  → runHermesTool
  → projectStore + nodeAgentRuntime（SSOT）
```

Brain（`hermes_chat_stream`）在阶段 1 **可选**接入检索片段；**Director / Tool 路径优先**，保证「能搭画布」可验收。

---

## 4. 影视 SOP ↔ 画布节点（映射真源）

| 影视阶段 | 画布实现（阶段 1） | 说明 |
|----------|-------------------|------|
| 策划 / 大纲 | `textNode` 或脚本 `prompt` | 不新建「策划节点」 |
| 脚本 | `scriptNode` | 镜头表 `scriptBeats` |
| 分镜文案 | `scriptNode.storyboardShots` | 工作台 / Hermes 生成分镜 |
| 文生图 | `imageNode` + 脚本建链 | 已有 chain / 批量出图 |
| 图生视频 | `videoNode` + Seedance | `video` draft / params |
| 配音 | `audioNode` | 阶段 1 仅搭节点占位，不执行 TTS |
| 剪辑 / 合成 | `ffmpegConcat` / compose | 阶段 1 可选占位节点 |
| 导出 | `compose.export_script` Tool | 已有 |

标准拓扑（阶段 1 默认）：`textNode → scriptNode → (imageNode∥videoNode per beat via chain)`，详见执行单。

---

## 5. 存储与隐私

| 项 | 路径 |
|----|------|
| 内置知识（随安装包） | `resources/hermes-knowledge/` 或仓库 `docs/hermes-knowledge/` 构建时拷贝 |
| 工程内索引副本 | `{project}/.canvasflow/hermes-knowledge-index.sqlite` |
| 用户扩展（远期） | `{project}/.canvasflow/hermes-knowledge-custom/` |

索引随工程重建；不依赖外网向量服务。
