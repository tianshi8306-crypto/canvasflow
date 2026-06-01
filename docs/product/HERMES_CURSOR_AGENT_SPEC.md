# Hermes = Cursor-style Agent · 产品规格

> **文档性质**：CanvasFlow 画布 Agent 的**产品真源**（PRD 级）。  
> **读者**：产品、设计、前端、Agent/后端、测试。  
> **版本**：v1.0 · 2026-05-26  
> **关联**：[HERMES.md](./HERMES.md) · [HERMES_SPIRIT_VISION.md](./HERMES_SPIRIT_VISION.md) · [CANVAS_AGENT_SPEC.md](./CANVAS_AGENT_SPEC.md)（P0 拍板摘要）

---

## 0. 一句话定义

**Hermes** 是嵌在 CanvasFlow 主窗口里的 **Cursor-style 自主影视 Agent**：

- **像 Cursor Agent**：多轮对话 + 观察画布 + 选工具 + 后台 Job + 边聊边干 + 从结果学习。  
- **不像通用 ChatGPT**：默认领域是 **短片制片**（剧本 → 分镜 → 出图 → 出视频 → 成片）。  
- **不像 Nous Hermes 安装包**：不独立部署、不开端口；**画布节点与 `canvasflow.json` 是唯一执行真相（SSOT）**。

智能来源四层（用户已确认）：

| 层 | 来源 | 作用 |
|----|------|------|
| **L0 大模型** | 设置 → 模型 → 文本 | 通用知识、推理、自然语言 |
| **L1 Skills** | 内置 + 工程 `.canvasflow/hermes/skills/*.md` | 制片专业技能与 SOP |
| **L2 记忆** | 工作记忆 + 长期成功经验 + 项目圣经 | 上下文连贯、越用越懂本工程 |
| **L3 Canvas Tools（MCP 语义）** | `runHermesTool` / 节点 Agent | 指挥画布，真正改数据、提交生成 |

---

## 1. 与 Cursor Agent 的对照（我们要抄什么、不抄什么）

### 1.1 Cursor Agent 核心范式

```text
用户消息
    │
    ▼
┌───────────────────────────────────────┐
│  Agent Loop（可多轮，直到 done/ask）   │
│  1. 读上下文（文件/规则/记忆/进行中任务）│
│  2. 推理：reply only / tool calls      │
│  3. 执行 tools → 观察结果              │
│  4. 写回记忆 / 继续或结束              │
└───────────────────────────────────────┘
    │
    ├── 对话通道（流式，不阻塞）
    └── 后台 Jobs（terminal、edit、search…并行/排队）
```

### 1.2 映射到 CanvasFlow

| Cursor | Hermes（目标） |
|--------|----------------|
| 代码库 / 打开文件 | **工程** + `canvasflow.json` + 节点 `data` |
| Read / Edit file | `canvas.summarize`、`storyboard.patch_shot`、`bible.update`… |
| Terminal / 命令 | 批量出图/出视频、导出、流程检查 |
| 后台改多个文件 | **Job 队列**：脚本 LLM、出图 batch、出视频 batch 可同时进行 |
| 用户继续聊天 | **P0 要求**：出图/出视频运行中 **不锁** H 输入框 |
| Rules / Skills | 项目圣经 + 用户 Skills + hermes-knowledge |
| 自动 apply diff | **可配置**：`agentAutoExecute` 自动改脚本/分镜/提交 API |
| 从会话学习 | **工作记忆** + **自动成功经验**（非仅「记住：」） |

### 1.3 明确不抄

- 独立 Agent 安装包、Telegram/Discord Gateway（Nous 路线）  
- 70+ 通用工具（计算器、任意 Shell）— 非制片必需不做  
- 替代画布：用户仍可在节点上**手改**；Agent 是驾驶舱，不是唯一入口  

---

## 2. 已确认的产品原则（拍板）

### 2.1 自主执行：可无人确认，用户自担风险

| 项 | 规格 |
|----|------|
| **能力** | Agent **可以**自动：改脚本/梗概、改分镜、批量出图、批量出视频、跑全自动链路 |
| **控制** | **设置 → Agent** 开关；默认建议 **开启**（与 iter-40 一致），用户可关 |
| **风险** | 设置页**必须**展示：API 费用、覆盖 prompt/分镜、失败与难回滚、须画布审核 |
| **关自动时** | 只输出计划/建议；用户回复「执行」「继续」后再调用工具 |
| **审核** | 北极星不变：**成片在画布审**；自动执行 ≠ 免审交付 |

### 2.2 并行：优先「聊天不阻塞出图/出视频」

| 项 | 规格 |
|----|------|
| **P0** | 制片 Job 运行时，用户仍可发消息（咨询、改创意、查进度、新指令） |
| **非 P0** | 多工程并行、跨 Tab 无关任务同时跑 |
| **UI** | 进度在**任务轨/角标/短气泡**展示，不用 `executingPlan` 锁死整个 Shell |

---

## 3. 六维能力规格

以下每条含：**目标行为 · 现状 · 优先级 · 验收要点**。

### 3.1 一、基础交互能力

| # | 能力 | 目标行为 | 现状 | 优先级 |
|---|------|----------|------|--------|
| I1 | **自然语言理解** | 口语、省略、多轮指代（「刚才那镜」「按上面风格」）可解析 | 规则+LLM+三分流(iter-43)；复杂句仍误判 | P0 持续 |
| I2 | **双向实时交互** | 聊→画布秒级反馈；画布改→Agent 下一轮感知 | 聊→执行有；画布改仅快照，无事件订阅 | P1 |
| I3 | **意图识别与主动补全** | 缺分镜时建议「是否生成分镜」；失败时建议重试 | iter-57/69：芯片 + Situation 去重、断点/排队、发送后忽略 | P1 持续 |
| I4 | **多模态输入** | 文字、@参考图、剧本文档、（远期）语音 | iter-65 侧栏麦克风：Web STT + Whisper 回退 | ✅ P2 |

**P0 验收（I1 + 并行）**  
- 执行中问「什么是蒙太奇」→ 顾问回复，且出图 Job 继续。  
- 「先别做，只聊聊」→ 本轮零制片 tool。

**交互架构**

```text
Hermes Shell（输入永不因单个 image job 禁用）
    │
    ├─► Chat Pipeline（consult / mixed 的 reply 部分）
    │
    └─► Orchestrator（execute / mixed 的 act 部分）
            │
            ▼
        Job Queue ──► Canvas Tools ──► projectStore / nodeAgentRuntime
```

---

### 3.2 二、内容生成与渲染能力

| # | 能力 | 目标 | 现状 | 优先级 |
|---|------|------|------|--------|
| G1 | 故事大纲、笔记 | brief、镜头表、脚本 beats | ✅ script 节点 + LLM | 维持 |
| G2 | 分镜脚本 | visualPrompt、运镜、时长 | ✅ storyboard agent | 维持 |
| G3 | 镜头生成（图/视频） | 批量、按镜号、失败重试 | ✅ Hermes tools + 节点 Agent | 维持 |
| G4 | 预览 | 节点预览、合成编辑器 | ✅ | 维持 |
| G5 | 导出 | 时间线 → mp4/mov/webm | ✅ compose.export + iter-58 | ✅ P1 |

**原则**：生成能力 **不重复造轮子**；Agent 只负责 **何时调、调哪条链、传什么上下文**。

---

### 3.3 三、智能编辑与迭代能力

| # | 能力 | 目标 | 现状 | 优先级 |
|---|------|------|------|--------|
| E1 | **增量修改** | 「把第 3 镜改成夜景」「标题改红」类 NL → 结构化 patch | iter-54 patch_shot + iter-76 梗概/圣经 NL | P1 持续 |
| E2 | **版本控制** | 脚本/分镜快照、对比、回滚 | iter-63/67 + **iter-83** 预快照/Agent 上下文/执行提示/主动芯片 | ✅ P2 |
| E3 | **错误修复** | 检测断链、失败镜、逻辑矛盾并自动/建议修复 | iter-79 `hermesProductionIssues` + loop 恢复优先 | P1 持续 |
| E4 | **优化建议** | 主动建议 prompt、节奏、镜数 | iter-64 + iter-81 稀疏描述/节奏/断链芯片 | P2 持续 |

**自动编辑与设置联动**  
- `agentAllowScriptEdit=true` → 允许 tool 写 brief/beats/storyboard。  
- 关闭时 → 只输出 diff 建议文本，不调用写工具。

---

### 3.4 四、理解与推理能力

| # | 能力 | 目标 | 现状 | 优先级 |
|---|------|------|------|--------|
| R1 | **全局理解** | 全片结构、阶段、缺什么 | iter-78 全片阶段/进度/瓶颈 + Situation | P0 持续 |
| R2 | **局部上下文** | 选中节点/镜号 | ✅ focus + 上游卡 | 维持 |
| R3 | **逻辑推理** | 补全缺失步骤、发现矛盾 | iter-80 `completePlanWithLogicalSteps` + LLM plan | P1 持续 |
| R4 | **长上下文** | 长剧本/多轮不丢约束 | iter-56 规则摘要 + iter-61 可选 LLM 摘要 + 近期 12 轮 | ✅ P1 |
| R5 | **多任务并行** | 聊 + 脚本 + 出图 + 出视频 **同时进行** | iter-68 咨询/制片双通道 + Job 队列 + 媒体并发 | ✅ P0 |

**记忆模型（核心）**

| 类型 | 存储（建议） | 内容 | 写入 |
|------|--------------|------|------|
| **会话记忆** | localStorage · 工程+Tab | 多轮对话 | 每条消息 |
| **工作记忆** | `.canvasflow/hermes/workstate.json` | 当前目标、active jobs、最近失败镜、用户本轮约束 | 消息/job 事件 |
| **长期记忆·事实** | `memory.json` + 用户技巧库 | 用户偏好、禁忌、「记住：」 | 用户教 + **自动** |
| **长期记忆·经验** | `skills/` 或 `memory.json` procedures | 「8 镜前先 motion 模板」 | **Job 成功后反思写入** |
| **项目圣经** | `.canvasflow/bible.json` | logline、风格、角色 | bible.update + UI |

**用户强调的「记忆」** = **工作记忆（正在干什么）** + **成功经验（怎么做成过）**；不是手动列表 alone。

---

### 3.5 五、工具与生态集成能力

| # | 能力 | 目标 | 现状 | 优先级 |
|---|------|------|------|--------|
| T1 | **Canvas Tool Registry** | 稳定 toolId、schema、副作用说明 | iter-72 + **iter-84** 风险/gate/参数摘要 + `isPlanStepAllowed` 走 Registry | P0 持续 |
| T2 | **知识库 RAG** | SOP、Seedance、分镜写法 | hermes-knowledge | 维持 |
| T3 | **Skills** | 内置 + 用户 Markdown | **iter-82** 触发词评分、分类目录、规划模板联动 | P1 持续 |
| T4 | **第三方 API** | 设置里 LLM/图/视/音 | ✅ | 维持 |
| T5 | **MCP** | 对外暴露 Canvas Tools；远期接 stdio Server | iter-66 stdio + localhost 桥 → runHermesTool | ✅ P2 |

**MCP 语义（对内真源）**

- **Tool** = 对画布的一次可审计操作（改 JSON / invoke 节点 Agent）。  
- **MCP Server**（远期）= 把同一套 tool schema 暴露给 Cursor/外部 Agent；**执行仍落本地 `runHermesTool`**。

**Tool 分类**

| 类 | 示例 | 需 `agentAutoExecute` |
|----|------|------------------------|
| 只读 | canvas.summarize, film.workflow_check | 否（可自动） |
| 写脚本 | script.*, bible.update, patch_shot | 是（或子开关） |
| 提交生成 | image/video.generate_for_beats | 是 + `agentAllowMediaSubmit` |
| 导出 | compose.export_script | 是 |
| 编排 | agent.delegate_parallel, template 展开 | 是 |

---

### 3.6 六、协作与管理能力

| # | 能力 | 目标 | 现状 | 优先级 |
|---|------|------|------|--------|
| M1 | **任务分解与跟踪** | 复杂指令 → 子任务 + 状态 | iter-71/72 + **iter-85** 队列优先级/插队/批量取消 | **P0** ✅ |
| M2 | **项目管理** | 多工程、Tab | ✅ | 维持 |
| M3 | **学习与适应** | 从操作与结果学习习惯 | iter-49 写入 + iter-70 规划/建议消费 `[proc:]`/`[avoid:]` | P1 持续 |
| M4 | **长期记忆** | 偏好、模板、历史项目模式 | iter-74 画像/分组检索 + memory.json | P1 持续 |
| M5 | **反思与自我改进** | 失败后分析、更新经验 | iter-49 规则 + iter-73 LLM post_job 复盘 | P1 ✅ |

---

## 4. Agent Runtime 规格（Cursor-style Loop）

### 4.1 单轮处理流程

```text
onUserMessage(text)
  │
  ├─ 1. 加载：settings.agent* · workstate · bible · situation · jobs · skills · memory
  ├─ 2. 分流：shell 指令 / agent 管理 / consult | execute | mixed
  │
  ├─ consult ──► Chat（advisor prompt + RAG）──► 结束（可并行于 jobs）
  │
  └─ execute|mixed
        │
        ├─ 3. Plan：规则快路径 → LLM plan（带 tool schema + guardrails）
        ├─ 4. 若 !agentAutoExecute → 展示 plan，等待「执行」
        ├─ 5. 若 auto → enqueue Jobs（不 await 整条链在 UI 线程）
        └─ 6. mixed → 先 stream plannerReply，再 enqueue
```

### 4.2 Agent Loop（P1，iter-48+）

在 **单个制片 Job** 内部或多步计划上：

```text
while not done:
  observe(canvas_snapshot, last_tool_result)
  decision = LLM({ tools, memory, settings })
  if decision.tools: run tools; continue
  if decision.ask_user: break
  if decision.done: break
post_job: reflect → maybe write experience memory
```

**与现 `executeDirectorPlan` 关系**：短期保留「计划 = 步骤列表顺序跑」；中期改为 **每步可 re-plan**（缺图则先出图，不盲跑模板）。

### 4.3 自主判断（该做 / 不该做 / 用什么）

| 场景 | 应有行为 |
|------|----------|
| 纯电影理论问答 | 只 reply；tools=[] |
| 有脚本无分镜，用户说「出图」 | 先 storyboard 或追问；或 auto 时先补分镜再 image |
| 有图无 video prompt | 先 film.shot_to_video_prompt |
| 无 Key / 无工程 | 拒绝 media submit，说明设置 |
| 用户「全自动跑片」 | 走 full-auto-export 或 LLM DAG；`agentAutoBatch` 控制确认 |
| 与 consult 混合 | mixed：先短 reply，再 enqueue |

---

## 5. Job 队列规格（P0 核心）

### 5.1 Job 类型

```typescript
type HermesJobKind =
  | "director_plan"    // 多步计划顺序执行（可拆）
  | "image_batch"
  | "video_batch"
  | "script_llm"       // 大纲/分镜 LLM
  | "export"
  | "subagent_parallel";

type HermesJobStatus =
  | "queued" | "running" | "done" | "failed" | "cancelled";

interface HermesJob {
  id: string;
  projectPath: string;
  tabId: string;
  kind: HermesJobKind;
  status: HermesJobStatus;
  title: string;           // 用户可见
  progress?: { done: number; total: number };
  error?: string;
  createdAt: number;
  finishedAt?: number;
}
```

### 5.2 并发策略

| 类型 | 同工程并发上限 | 说明 |
|------|----------------|------|
| chat | 无限制 | 与制片解耦 |
| image_batch | 2（可配置） | 防 API 打满 |
| video_batch | 1～2 | 同上 |
| director_plan | 1 | 避免同时改同一 scriptNode |
| export | 1 | |

### 5.3 UI 行为

| 状态 | 输入框 | 反馈 |
|------|--------|------|
| 0 个 running job | 正常 | — |
| N 个 running | **可输入** | 任务轨/Orb 角标；对话可插入进度行 |
| 未配置模型 | 禁用 + 提示 | 链到设置 |

**与 iter-40「无任务轨 UI」的演进**  
- 不在侧栏恢复「制片控制台」大面板；允许 **轻量任务轨**（仅 Job 列表 + 取消），符合 Cursor 后台任务感。

---

## 6. 设置 → Agent（完整 IA）

**路径**：设置 → **Agent**（与「模型」并列）

### 6.1 开关

| 键 | 标签（建议） | 默认 | 说明 |
|----|--------------|------|------|
| `agentAutoExecute` | 自动执行制片操作 | 开 | 关=仅计划，需回复「执行」 |
| `agentAutoBatch` | 大批量免确认 | 开 | ≥4 镜不再问「继续」 |
| `agentAllowScriptEdit` | 允许自动改脚本/分镜 | 开 | 关=只建议不写入 |
| `agentAllowMediaSubmit` | 允许自动提交出图/出视频 | 开 | 关=不调用生成 API |
| `agentMaxConcurrentMedia` | 同时生成任务上限 | 2 | 数字 1～3 |

### 6.2 风险须知（折叠，必现）

- 自动修改可能**覆盖**已有分镜与提示词。  
- 批量生成将消耗 **API 额度**，费用以服务商账单为准。  
- 生成失败或质量不佳需用户在**画布**调整；Agent 不保证可发行成片。  
- 建议在重要节点**保存工程**或依赖自动保存。

### 6.3 与现有设置关系

- **模型**：Agent 对话/规划用「文本」Provider；出图/视用各自节点配置。  
- **Hermes Chain 自动建链**：保留；与 Agent 并存，Agent 可调用 chain tools。  
- **记忆根目录**（`hermes_memory_root`）：继续作用于用户技巧库。

---

## 7. 数据与存储布局

```text
<工程>/
  canvasflow.json              # SSOT：节点与边
  .canvasflow/
    bible.json                 # 项目圣经
    hermes/
      memory.json              # 长期记忆 facts
      workstate.json           # 工作记忆（目标、jobs 摘要）
      automations.json         # 定时任务（P2）
      skills/*.md              # 用户 Skills
    hermes-knowledge-user/     # 用户技巧（RAG）
```

**对话历史**：`localStorage` · `projectPath + tabId`（iter-43）。

---

## 8. 分阶段路线图

| 阶段 | 迭代 | 交付 | 用户可感知 |
|------|------|------|------------|
| **P0-a** | iter-46 | Agent 设置 + 风险；执行中 consult 不阻塞 | 可关自动；边跑边聊（咨询） |
| **P0-b** | iter-47 | Job 队列 + 轻量任务轨；media 异步 | 边跑边聊（含新制片指令排队） |
| **P1-a** | iter-48 | workstate 工作记忆 | 更稳的「该先做什么」 |
| **P1-a2** | iter-53 | Agent loop（步内 re-plan） | 缺图先出图、失败插入修复 |
| **P1-d** | iter-54 | NL → `patch_shot` 稳定解析 | 「第 N 镜改成…」可执行 |
| **P1-e** | iter-55 | 全链路 workflow 修复 + loop | 检查并修复、失败重试 |
| **P1-f** | iter-56 | R4 长上下文 workstate 摘要 | 长剧本/多轮不丢约束 |
| **P1-g** | iter-57 | I3 主动补全增强 | 缺分镜/缺图/失败 → 一键预填 |
| **P1-b** | iter-49 | 自动成功经验 + 反思写 memory/skill | 越用越懂本工程 |
| **P1-c** | iter-50 | 画布事件感知 + 主动建议 | 改镜后 Agent 知晓 |
| **P2** | iter-51+ | 语音、外接 MCP、版本 diff、多格式导出 | 生态扩展 |

**已完成、作为基础**  
iter-40 对话唯一入口 · iter-43 顾问/三分流 · iter-44 全自动跑片 · iter-45 记忆/Skills/MCP 桥雏形。

---

## 9. 非目标（v1 明确排除）

- 安装 Nous Hermes / 独立 Agent 服务 / Telegram Bot  
- 默认云端 Hermes API（仅用户自填 Provider URL）  
- 100% 无人审片、App 关闭仍跑生成  
- 多工程全局调度（P0 不做）  
- 用 Agent **完全替代**节点 UI 手改  

---

## 10. 验收场景（Golden Scenarios）

### GS-1 边聊边出图（P0）

1. 设置：自动执行 **开**。  
2. 用户：「把 1–6 镜出图。」  
3. **立即**再发：「解释一下赛博朋克视觉从哪来。」  
4. **通过**：出图 Job 进行中；第二条得顾问回复；输入框始终可用；进度可见。

### GS-2 关自动（P0）

1. 设置：自动执行 **关**。  
2. 用户：「分镜出图。」  
3. **通过**：展示计划，无 API 调用；用户「执行」后才开始。

### GS-3 全自动跑片 + 断点（已有，回归）

1. 「全自动跑片：…」→ 模板执行；失败「继续跑片」。

### GS-4 记忆（P1）

1. 8 镜出视频前自动补 motion 模板成功。  
2. 下次类似工程 Agent **优先**该步骤（来自经验记忆，非用户手动教）。

### GS-5 不应发生

- 纯咨询触发出图 API。  
- 无工程时写入脚本或导出。  
- 单 Job 锁死 H 输入无法问进度（P0 修复后）。

---

## 11. 架构图（目标态）

```text
┌─────────────────────────────────────────────────────────────────┐
│                     CanvasFlow App (Tauri)                       │
│  ┌─────────────┐  ┌──────────────────────┐  ┌───────────────┐ │
│  │ FlowCanvas  │◄─┤  Hermes Agent Runtime │─►│ 设置→Agent    │ │
│  │ (SSOT)      │  │  Loop·Plan·Guardrails │  │ 设置→模型     │ │
│  └──────▲──────┘  └──────────┬───────────┘  └───────────────┘ │
│         │                     │                                  │
│         │          ┌──────────┴──────────┐                       │
│         │          │  Job Queue          │                       │
│         │          │  chat ∥ image ∥ …   │                       │
│         │          └──────────┬──────────┘                       │
│         │                     │                                  │
│         └─────────────────────┤ Canvas Tools (MCP)              │
│                               │ runHermesTool → nodeAgentRuntime │
│  Memory: workstate · memory · bible · skills · knowledge RAG      │
└─────────────────────────────────────────────────────────────────┘
         LLM（通用）          Skills（专业）         Tools（执行）
```

---

## 12. 文档索引

| 文档 | 用途 |
|------|------|
| **本文** | Cursor-style Agent 完整产品规格 |
| [CANVAS_AGENT_SPEC.md](./CANVAS_AGENT_SPEC.md) | P0 拍板与 iter-46～48 摘要 |
| [HERMES.md](./HERMES.md) | 现网架构与交互原则 |
| [HERMES_AUTONOMOUS_AGENT.md](./HERMES_AUTONOMOUS_AGENT.md) | iter-45 实现对照 |
| [HERMES_SPIRIT_VISION.md](./HERMES_SPIRIT_VISION.md) | Octo 对标与灵体愿景 |
| [HERMES_FILM_KNOWLEDGE.md](./HERMES_FILM_KNOWLEDGE.md) | 知识库与 RAG |

---

## 13. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-26 | 首版：六维能力 + Cursor 范式 + 拍板原则 + Job/记忆/设置 |
