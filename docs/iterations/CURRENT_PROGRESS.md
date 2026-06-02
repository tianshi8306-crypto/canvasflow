# 当前进度与下一步规划（异地协作）

> **固定入口**：本文档为「进度 + 规划 + 代码索引」的**主文档**，请在异地开发时优先阅读本文。  
> 更新日期：**2026-05-26**  
> 仓库：**canvasflow**（Tauri + React + React Flow）  
> 历史同名快照：`REMOTE_DEV_HANDOFF_2026-04-28.md`（内容与本文同步后仅作锚点，见该文件说明）。

---

## 1. 文档目的

- 汇总**当前开放进度**（相对路线图 R1～R9 与产品对齐文档）。  
- 给出**下一步可执行规划**（优先级、边界、验收建议）。  
- 列出**关键代码入口**，减少在陌生环境下的探索成本。

更细的设计对照见：[`docs/design/architecture-spec-vs-implementation.md`](../design/architecture-spec-vs-implementation.md)  
路线图版本见：[`docs/iterations/ROADMAP_V2.md`](ROADMAP_V2.md)  
产品与 LibTV 对齐见：[`docs/product/LIBTV_GUIDE_ALIGNMENT.md`](../product/LIBTV_GUIDE_ALIGNMENT.md)  
画布快捷键见：[`docs/product/SHORTCUTS.md`](../product/SHORTCUTS.md)  
**成熟度监控（已完成）**：[`GOLDEN_PATH.md`](../product/GOLDEN_PATH.md) · [`RELEASE_CHECKLIST.md`](../../RELEASE_CHECKLIST.md) A/B/C 档 · `npm run release:check` · [`iteration-19-maturity-monitoring.md`](iteration-19-maturity-monitoring.md)  
**黄金路径 P0/P1（已完成）**：10 步对照 + E2E 4 条 · [`iteration-95-golden-path-p0-p1.md`](iteration-95-golden-path-p0-p1.md)  
**设置「模型」IA（已完成）**：子 Tab 总览/文本/图/视/音 · 默认 1+2+2+1 · 即梦登录在总览 · [`iteration-20-settings-models-ia.md`](iteration-20-settings-models-ia.md)  
**Hermes / 画布 Agent**：**[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md)** · iter-45～85 ✅  
**产品状态矩阵**：**[PRODUCT_STATUS_MATRIX.md](../product/PRODUCT_STATUS_MATRIX.md)** · 阶段 5 → **[EPIC_STAGE5_BACKLOG.md](../product/EPIC_STAGE5_BACKLOG.md)**

### UX 决策（无限画布方案，2026-05-18）

- **不采用** LibTV 式底部生成器 Dock。
- 图片 / 视频 / 音频：**节点外浮层**（Portal）+ **节点/全屏/最大化** 承载元数据（`Inspector.tsx` 样式已备但**运行时未挂载**，见 [`iteration-15-canvas-chrome-libtv-parity.md`](iteration-15-canvas-chrome-libtv-parity.md) §0）；节点卡保持预览与生成分离（见 [`docs/图片节点设计.md`](../图片节点设计.md)）。
- 规范参考：[`docs/无限画布.pdf`](../无限画布.pdf)、[`docs/节点UI设计规范.txt`](../节点UI设计规范.txt)（色板/状态作 token 参考，不强制节点内算力条）。

---

## 2. 环境与运行约定

| 项 | 说明 |
|----|------|
| 桌面端 | `src-tauri` + `npm run tauri dev`（或项目既有脚本）；部分能力仅 Tauri 可用（文件对话框、密钥环、子图执行等）。 |
| 前端检查 | 仓库根目录：`npx tsc --noEmit` |
| 后端检查 | `src-tauri`：`cargo check` / `cargo test`（按需） |
| 全局样式 | 大量 UI 在 `src/styles/global.css`；配色真源 [`docs/design/canvas-color-system.md`](../design/canvas-color-system.md)（`--cf-*`）；遗留 `--bg`/`--text`/`--canvas-float-*` 已别名到炭黑+柔白。**配色 P1（2026-05-21）**：节点壳 L1、浮层菜单实底、类型左条、默认灰连线、选中白描边。**配色 P2（2026-05-21）**：右侧 Inspector L2、顶栏/设置/全局表单焦点环。**配色 P3（2026-05-21）**：脚本表/分镜网格/全屏 Lib 视图对齐 §9，选中行左条 + 淡蓝底。 |

---

## 3. 路线图位置（粗粒度）

按 `ROADMAP_V2.md` 的 R 划分，当前 **R1～R4 主体已落地，C.1/C.2/C.3 架构能力已实现**：

| 阶段 | 状态 | 说明 |
|------|------|------|
| R1 工程与保存 | 基本具备 | 工程 JSON、撤销重做、顶栏状态等。 |
| R2 五类节点画布体验 | 持续迭代 | 小地图、`F`/`Z` 视口、整理画布确认、图片浮层生成；无底部 Dock。 |
| R3 脚本工作台 | **主体可用** | Inspector 工作台 + 全屏表（`iteration-03/06`）；画布为 `MinimalScriptNode` Chrome（`iteration-08`）；体验对齐见 §4.2。 |
| R4 分镜 | **产品化完成** | `storyboardShots`、`ScriptStoryboardSection` + Hermes 自动串联、失败重试。 |
| R5 多模态输入 | **UI 迭代中** | `VideoMultimodalInputPanel` + `VideoGenerationStatusRail`（`iteration-16-r5-video-generation-panel.md`）：状态轨固定于参数栏上方、Popover 分组标题。 |
| R6 时间线合成 | **基础 + 剪辑台** | `ComposeEditorOverlay` 时间线编辑；`exportScriptCompose` / `render_timeline`；见 iteration-18。 |
| C.1 节点状态机 | ✅ 已实现 | 节点执行状态可见（idle/pending/running/succeeded/failed/skipped）。 |
| C.2 失败策略 | ✅ 已存在 | 后端自动标记下游 skipped，`abortWorkflowOnFailure` 配置。 |
| C.3 子图重跑 | ✅ 已存在 | 后端 `run_subgraph_inner`，前端"重跑失败子图"按钮。 |

---

## 4. 近期已实现（与主线强相关）

以下对应「脚本中枢 + 画布生产链路」近期交付，便于异地理解**行为契约**：

### 4.0 画布打组（迭代 16-A～E，2026-05-21）

方案：[`画布打组功能方案.md`](../product/画布打组功能方案.md)

| 迭代 | 能力 |
|------|------|
| 16-A | 分组工具条、组标题、选中策略 A |
| 16-B | 组框 resize、排列后自动扩组 |
| 16-C | 整组执行、创建副本、批量导出 `assets/export/` |
| 16-D | 转分镜组、工具箱模板、Hermes/建链组内范围 |
| 16-E | 组色标、组级运行态角标、宫格/横向/纵向排列 |

入口：`GroupToolbar.tsx`、`GroupNode.tsx`、`LeftAddDock` 工具箱区；store：`projectGroupRuns.ts`、`projectGroupProduction.ts`。

### 4.1 脚本节点解析与执行器（Rust）

- **输入来源放宽**：不再强制「必须连接上游文本节点」。  
  - 有上游剧本文本：仍按「解析要求 + 待解析剧本文本」双段拼进 LLM。  
  - 无上游、仅有上游 **videoNode** 路径：在 `executor.rs` 中收集参考视频路径，生成「待解析素材」说明块（纯文本模型无法真正「看视频」，提示中已说明可据元信息推断）。  
  - 无上游、无视频：**单框合写**——整段 `prompt` 作为「剧本文本与创作要求」一段输入。  
- **参考视频**：除前端连线外，**执行器从图结构读取** `videoNode.data.path`，与上游文本并存时追加「参考视频」块。  
- 关键文件：`src-tauri/src/executor.rs`（`run_script_node`、`incoming_reference_video_paths_ordered` 等）。

### 4.2 脚本节点前端（React：MinimalScriptNode + 基线）

> **功能真源**：[`脚本节点功能说明.md`](../product/脚本节点功能说明.md)  
> **基线与排期（§0 视为已完成，勿重做工作台/全屏）**：[`脚本节点开发顺序.md`](../product/脚本节点开发顺序.md)

#### 画布节点（Chrome，`iteration-08` P0–P2 已完成）

| 项 | 说明 |
|----|------|
| **注册入口** | `nodeTypes.scriptNode` → `MinimalScriptNode.tsx`（**非**旧卡内 `ScriptNode.tsx`；后者文件仍在仓库，**未**挂 `nodeTypes`） |
| **壳** | `NodeChromeShell` + 迷你表（最多 3 行）；**单击预览区** → `openScriptFullscreen`（`script-10-1A`） |
| **底栏 Portal** | `ScriptComposerPanel` — 主题、`@` / `/`、`ScriptModelPicker`、**AI 解析镜头**；钉住 / 展开主题 Modal |
| **顶栏 Portal** | 有镜头且单选：**重新解析 \| 生成分镜 \| 全屏表格 \| 编辑主题 \| 下载** |
| **双击节点** | 画布 zoom 200% 居中（`useFocusScriptNodeViewport`），**不**直接开全屏 |
| **空态** | `ScriptNodeUpstreamTextFloat`「从文本同步」；壳内一行入口指引（底栏主题 → 解析后进全屏） |

执行单：[`iteration-08-script-node-chrome.md`](iteration-08-script-node-chrome.md)、入口收敛 [`iteration-10-script-entry-converge.md`](iteration-10-script-entry-converge.md)。

#### 四处编辑界面（职责固定，后续迭代只「修补」不「重做」）

| 界面 | 主要文件 | 职责 |
|------|----------|------|
| 画布壳 + Portal | `MinimalScriptNode`、`ScriptComposerPanel*`、`ScriptPreviewToolbar*` | 摘要、解析/分镜快捷、主题与全屏入口 |
| Inspector 工作台 | `ScriptNodeWorkbench` + `ScriptWorkbench*` | **主编辑**：表/卡、批量、模板、镜号工具、「全屏表格」钮 |
| 全屏 Overlay | `ScriptNodeFullscreenOverlay`、`ScriptBeatsEditorTable` | Lib 宽表 + **创意视图** Tab（`ScriptCreativeViewGrid`） |
| 节点最大化 | `NodeMaximizedOverlay` | 嵌工作台 + 分镜区（画布右键双击脚本节点） |

#### 已完成基线（与开发顺序 §0 一致）

| 能力 | 参考 |
|------|------|
| 工作台 v1（表/卡、勾选持久化、批量、模板 localStorage） | R3、`iteration-03-script-workbench.md` |
| 全屏表（字段显隐/筛选/键盘流、角色图·参考媒体入 `assets/`） | `iteration-06-script-fullscreen-table.md` |
| 分镜文案 LLM、侧栏分镜区、Hermes / 批量视频 | R4、本文 §4.8 |
| DAG 解析、上游文本 / 参考视频路径 | 本文 §4.1、`src-tauri/.../script_node.rs` |
| 画布 Chrome（壳 / 顶底 Portal / pin·expand） | `iteration-08` |
| `scriptBeatId` 下游绑定、粘贴 beatId 重映射 | Inspector、`pasteScriptBeatRemap` |

#### 近期体验对齐（2026-05-21，在基线上增量）

| 迭代 ID | 内容 | 关键文件 |
|---------|------|----------|
| script-09-0A | 画布顶栏 / 全屏 / 侧栏「生成分镜」勾选规则统一 | `scriptStoryboardScope.ts` |
| script-09-0B | 快速草案 vs **AI 解析** 文案；解析/分镜 `preflight` + `llmParams` | `scriptNodeActionLabels.ts`、`scriptNodeLlmParams.ts` |
| script-10-1A | 顶栏恢复全屏/主题；壳内点击进全屏；Inspector/最大化入口说明 | `scriptNodeCanvasEntries.ts` |
| script-10-1B | busy/失败/0 条引导；创意视图定位失败镜头 | `scriptNodeFeedback.ts`、`useScriptNodeTaskState.ts` |
| script-11-2A | 上游文本节点剧本导入（非 txt 文件） | `scriptUpstreamText.ts`、`ScriptUpstreamTextBanner` |
| script-11-2B | 参考视频可发现 | `scriptReferenceVideo.ts`、`ScriptReferenceVideoBanner` |
| script-12-3A | 创意视图 ↔ 分镜资产（勾选/选图/分镜区） | `ScriptCreativeViewGrid`、`scriptStoryboardImageImport` |
| script-12-3B | 角色/卡片视图与表格联动 | `ScriptBeatRolesEditor`、`applyCharactersToBeat` |

| script-13-4A | 勾选驱动批量建链（图/视频/音频） | `scriptBeatChainBuild.ts` |
| script-13-4B | Hermes 自动建链策略 | `hermesAutoChainPolicy.ts` |
| script-14-4C | 批量视频/合成导出稳态 | `scriptProductionExport.ts`、`ScriptStoryboardSection` |

**脚本子集建议下一步**（见开发顺序 §10）：阶段 4 收尾或阶段 5 Epic 排期。  
**明确非目标**：重做 `ScriptNodeWorkbench` / 全屏表 / 分镜区核心逻辑。

### 4.3 侧栏 Inspector：镜头绑定

- 图片 / 音频 / 视频节点：在存在上游 `scriptNode` 且其有 `scriptBeats` 时，**`scriptBeatId` 以下拉列出镜头**（镜号 + 描述摘要）；选择时写入 `shotNumber`；未在列表中的已保存 id 保留「孤儿」选项。  
- 文件：`src/components/Inspector.tsx`（保留；**未挂到 App**）。分镜聚焦：`openInspectorStoryboardBeat` → 脚本全屏创意视图（`iteration-15` §0）。

### 4.4 脚本表格类型安全

- `ScriptBeatsEditorTable` 中 `TableColKey` 与 `ScriptBeatStringKey` 混用导致的 TS 报错，已通过 `fieldKey` 收窄修复。  
- 文件：`src/components/ScriptBeatsEditorTable.tsx`。

### 4.5 文本节点 Chrome（S1–S7 状态机，2026-05-20）

- **真源**：[`docs/design/text-node-states-spec.md`](../design/text-node-states-spec.md)（显隐矩阵 + 附录对照表）。  
- **实现**：`TextNode.tsx` — 壳内双击编辑、外置 Composer、workflow 连线静默同步、顶栏格式+图标工具、关联节点定位（`useFocusLinkedPartnerNode`）。  
- **快捷键**：`Ctrl+Shift+G` 钉住模型对话；见 [`docs/product/SHORTCUTS.md`](../product/SHORTCUTS.md)。  
- **历史方案**：`text-node-chrome-optimization.md`（C1–C4）§5.2 显隐表已废止，勿按四 Chip / 顶栏文档组实现。

### 4.6 画布左键 / 右键添加菜单

- **左键双击空白**打开的「添加」面板，已与**空白处右键 → 添加节点**二级菜单对齐：同一 `canvasPaneCtxMenuRoot` + `PaneAddRow`（含图标）、宽度与右键二级一致（`contextPaneL2` / 图库页 `gallery`）。  
- 曾尝试「左键菜单去图标 + 紧凑尺寸」，已按产品要求**撤销**，当前即上述对齐版。  
- 文件：`src/components/canvas/CanvasContextMenus.tsx`、`src/components/canvas/menuConstants.ts`、`src/components/FlowCanvas.tsx`。

### 4.7 依赖与清理

- 已移除不再使用的 **`mammoth`**（曾用于文档导入后删除该能力）。

### 4.7 视频链路重构 + 质量门禁体系建设（2026-05 实现）

本轮在 **R4 / R5 视频生产链路**和**质量保障**两个方向上同时推进，属于 P0 级别的生产链路闭环建设。

#### 4.7.1 视频生成三命令（Rust 后端）

新增 `src-tauri/src/commands/video_cmd.rs`，实现视频生成异步任务引擎：

- **`video_gen_start`**：接受 `project_path`、`node_id`、`payload`（含 `model_id`），优先调用 Doubao Seedance 2.0 API；未配置 API Key 或调用失败时自动降级生成 `mock_{uuid}` job_id，写入 `AppState.video_jobs`。
- **`video_gen_get_job`**：两阶段锁策略——前 3 次 poll 返回 `queued`/`running`（progress 25/50/75%），第 4 次 poll 才做 IO；若 `poll_video_job_http` 失败，降级用 ffmpeg 生成 640x360 黑屏 2 秒 mp4，写入 `assets/mock_video_{timestamp}_{uuid8}.mp4` 并登记素材库。返回 `VideoJobSnapshot`（含 `result_rel_path`）。
- **`video_gen_cancel`**：将 `cancelled = true`，下次 `getJob` 检测到即返回 `cancelled` 状态。

旧实现 `video_mock_cmd.rs` 已废弃但保留，mod.rs 不再导出，避免宏冲突。

#### 4.7.2 视频前端架构（mode / bridge / apiPool）

| 文件 | 作用 |
|------|------|
| `src/lib/videoGeneration/mode.ts` | 解析 `VITE_VIDEO_GENERATION_MODE` 环境变量 > localStorage > isTauri 默认值，三选一；支持 `bridge`/`mock`/`auto` 三模式 |
| `src/lib/videoGeneration/bridge.ts` | 统一入口：按模式路由，`bridge` 调 Tauri invoke，`mock` 走本地 mock client，`auto` 失败时自动 fallback |
| `src/lib/videoGeneration/apiPool.ts` | mock client 实现：本地轮询模拟、`startJob`/`getJob`/`cancelJob`/`listModels` 接口 |
| `src/hooks/useVideoNodeGeneration.ts` | React hook，封装 `startJob`/`getJob`/`cancelJob` 调用 |

#### 4.7.3 自动化测试体系（Vitest + jsdom + testing-library）

**测试基础设施**：

- `vitest.config.ts`：新增 `environment: "jsdom"` + `setupFiles: ["./vitest.setup.ts"]`；覆盖率阈值 lines 60% / functions 60% / branches 50% / statements 60%
- `vitest.setup.ts`：全局导入 `@testing-library/jest-dom/vitest`，提供 `toBeInTheDocument()` 等 DOM 断言
- 新增 devDependencies：`jsdom`、`@testing-library/jest-dom`、`@testing-library/react`、`@testing-library/user-event`、`@vitest/coverage-v8`

**新增测试文件**（21 个测试文件 / 173 个测试）：

| 文件 | 测试数 | 覆盖内容 |
|------|--------|----------|
| `src/lib/videoGeneration/bridge.test.ts` | 5 | bridge/mock/auto 三模式路由、失败 fallback、取消 |
| `src/lib/videoGeneration/mode.test.ts` | 17 | 优先级 env > localStorage > isTauri、trim/case-insensitive、无效值回退 |
| `src/lib/videoGeneration/apiPool.test.ts` | 9 | mock job 生命周期（queued→running→succeeded）、cancelJob、listModels |
| `src/lib/nodeAgentRuntime/runNodeTaskAgent.test.ts` | 13 | 生命周期 start→sense→execute→validate→commit→end、error 路径、事件内容验证 |
| `src/lib/scriptBeatsTableModel.test.ts` | 44 | patchRow/Characters、serialize/parseCharacters、模板互转、filter、role field sync、getRoleCompat 兼容层 |
| `src/components/ScriptBeatsEditorTable.test.tsx` | 19 | Esc 关闭弹窗、Tab/Arrow 导航、Enter 切换列显隐、至少保留 1 列、localStorage 持久化、筛选行为、variant 渲染 |

#### 4.7.4 文档与门禁标准化

- **CONTRIBUTING.md §6**：质量门禁改为引用 `npm run quality:gate`（含 lint / typecheck / vitest 覆盖率 / rust test）
- **README.md**：新增「质量门禁」节，详述 `quality:gate` / `quality:gate:full` 两档命令及 E2E 安装步骤
- **新建 `RELEASE_CHECKLIST.md`**：质量门禁命令详解 + 手工验收清单（6 项）+ 文档对齐检查清单（5 项）

#### 4.7.5 质量门禁命令体系

```bash
npm run quality:gate       # typecheck + lint + vitest coverage + rust test（日常提交）
npm run quality:gate:full # quality:gate + playwright e2e（CI 完整门禁）
```

覆盖区间：lines 60% / functions 60% / branches 50% / statements 60%

### 4.8 R4 分镜产品化 + Hermes 自动串联（2026-05-07 实现）

#### 4.8.1 R4 分镜产品化增强

`ScriptStoryboardSection` 分镜网格增强：

- **状态分类统计**：新增 `generatedShots`、`failedShots`、`idleShots`、`generatingShots` 及数量计数
- **健康状态栏增强**：显示"已生成 X"和"失败 X"；生成中时动态更新
- **批量重试失败**：新增"重试失败（X）"按钮，批量重试所有失败的分镜生成
- **卡片样式增强**：
  - `.storyboardCard--generated`：成功状态绿色边框和淡绿背景
  - `.storyboardStatusBadge--generated`：绿色成功徽章 ✓
- **Hermes 手动触发**：新增"Hermes 串联（X）"按钮，为已生成分镜的镜头创建下游节点

关键文件：`src/components/ScriptStoryboardSection.tsx`

#### 4.8.2 Hermes 自动串联核心

新增 `src/lib/hermes/` 模块：

| 文件 | 作用 |
|------|------|
| `src/lib/hermes/index.ts` | 入口，`initHermesAutoChain()` 初始化全局事件监听 |
| `src/lib/hermes/autoChain.ts` | 核心逻辑，监听 `node-agent-event`，自动创建 `imageNode` + `videoNode` 配对 |
| `src/lib/hermes/shotNodeFactory.ts` | 节点工厂，计算位置、创建节点数据 |
| `src/lib/hermes/types.ts` | 类型定义 `HermesShotNodeGroup`、`HermesAutoChainResult` |

触发条件：`scriptNode` 执行完成（`agentName === "脚本调度 Agent"` 且 `phase === "end"`）

### 4.8.3 Hermes Cursor Agent 运行时（iter-45～53，2026-05-26）

真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md)

| 迭代 | 能力 | 关键文件 |
|------|------|----------|
| 45～46 | Agent 设置、`agentAutoExecute`、风险说明 | `hermesAgentSettings.ts`、`SettingsAgentSection.tsx` |
| 47 | `director_plan` Job 队列 | `hermesJobStore.ts`、`HermesSidebar.tsx` |
| 48 | 工作记忆 `workstate.json` | `hermesWorkstate.ts`、`hermesAgentContext.ts` |
| 49 | 成功后自动写经验 / Skill | `hermesJobReflection.ts` |
| 50 | 画布事件感知（手改/选中） | `hermesCanvasEvents.ts`、`initHermesCanvasAwareness.ts` |
| 51 | 媒体并发上限 | `agentMaxConcurrentMedia` |
| 52 | 外接 MCP stdio | `hermesExternalMcp.ts` |
| **53** | **步内 Agent loop**：observe → preflight 补依赖 → 失败 recovery | `hermesAgentLoop.ts`、[`iteration-53-hermes-agent-loop.md`](iteration-53-hermes-agent-loop.md) |
| **54** | **NL 增量编辑**：口语 → `patch_shot` 结构化参数 | `hermesNlPatch.ts`、[`iteration-54-hermes-nl-patch.md`](iteration-54-hermes-nl-patch.md) |
| **55** | **全链路修复**：workflow_check ↔ loop 自动修断链 | `hermesWorkflowRepair.ts`、[`iteration-55-hermes-workflow-repair.md`](iteration-55-hermes-workflow-repair.md) |
| **56** | **R4 长上下文**：工程/对话摘要进 workstate | `hermesLongContext.ts`、[`iteration-56-hermes-long-context.md`](iteration-56-hermes-long-context.md) |
| **61** | **R4 LLM 摘要**：workstate 可选 LLM 压缩 | `hermesLongContextLlm.ts`、[`iteration-61-hermes-long-context-llm.md`](iteration-61-hermes-long-context-llm.md) |
| **62** | **跨 Tab digest**：全 Tab 对话并入 workstate | `hermesCrossTabDigest.ts`、[`iteration-62-hermes-cross-tab-digest.md`](iteration-62-hermes-cross-tab-digest.md) |
| **63** | **P2 E2 版本链**：脚本/分镜快照与回滚 | `hermesScriptVersion.ts`、[`iteration-63-hermes-script-version-chain.md`](iteration-63-hermes-script-version-chain.md) |
| **64** | **P2 E4 优化建议**：镜数/提示词主动芯片 | `hermesProactiveSuggestions.ts`、[`iteration-64-hermes-optimize-suggestions.md`](iteration-64-hermes-optimize-suggestions.md) |
| **65** | **P2 I4 语音输入**：Hermes 麦克风 STT | `hermesVoiceInput.ts`、`transcribe_speech_audio`、[`iteration-65-hermes-voice-input.md`](iteration-65-hermes-voice-input.md) |
| **66** | **P2 T5 对外 MCP**：stdio Server + 本地桥 | `canvasflow-mcp-server.mjs`、`canvas_mcp_bridge.rs`、[`iteration-66-canvas-mcp-server.md`](iteration-66-canvas-mcp-server.md) |
| **67** | **E2 可视化 diff**：版本对比浮层 | `hermesScriptVersionDiff.ts`、`HermesScriptVersionDiffOverlay.tsx`、[`iteration-67-hermes-script-version-visual-diff.md`](iteration-67-hermes-script-version-visual-diff.md) |
| **68** | **R5 多任务并行**：对话与制片双通道 | `hermesParallelChannel.ts`、[`iteration-68-hermes-parallel-r5.md`](iteration-68-hermes-parallel-r5.md) |
| **69** | **I3 主动补全打磨**：Situation/芯片去重、断点续跑、发送后忽略 | `filterSidebarProactiveChips`、[`iteration-69-hermes-proactive-polish.md`](iteration-69-hermes-proactive-polish.md) |
| **70** | **M3 学习与适应**：消费成功经验、忽略偏好 | `hermesLearningAdaptation.ts`、[`iteration-70-hermes-learning-adaptation-m3.md`](iteration-70-hermes-learning-adaptation-m3.md) |
| **71** | **M1 Job 中心**：制片任务展开、排队取消、后台任务 | `HermesJobCenter.tsx`、[`iteration-71-hermes-job-center-m1.md`](iteration-71-hermes-job-center-m1.md) |
| **72** | **M1 取消执行中 Job + T1 工具 Registry** | `hermesJobStore` shouldAbort、`hermesToolRegistry.ts`、[`iteration-72-hermes-job-cancel-tool-registry.md`](iteration-72-hermes-job-cancel-tool-registry.md) |
| **73** | **M5 LLM 任务复盘** | `hermesJobReflectionLlm.ts`、`agentPostJobLlmReflect`、[`iteration-73-hermes-m5-llm-reflect.md`](iteration-73-hermes-m5-llm-reflect.md) |
| **74** | **M4 长期记忆增强** | 画像/分组/检索、`hermesPersistentMemory`、[`iteration-74-hermes-m4-memory.md`](iteration-74-hermes-m4-memory.md) |
| **75** | **Job sessionStorage 持久化** | `hermesJobPersistence.ts`、[`iteration-75-hermes-job-session-persist.md`](iteration-75-hermes-job-session-persist.md) |
| **76** | **E1 NL 梗概/圣经增量编辑** | `hermesNlEdit.ts`、[`iteration-76-hermes-nl-edit-e1.md`](iteration-76-hermes-nl-edit-e1.md) |
| **77** | **M5×M3 复盘加权学习** | `[reflect-proc:]`、`hermesLearningAdaptation`、[`iteration-77-hermes-m5-m3-reflect-boost.md`](iteration-77-hermes-m5-m3-reflect-boost.md) |
| **78** | **R1 全片理解块** | `hermesGlobalUnderstanding.ts`、[`iteration-78-hermes-r1-global-understanding.md`](iteration-78-hermes-r1-global-understanding.md) |
| **79** | **E3 制片断链检测** | `hermesProductionIssues.ts`、[`iteration-79-hermes-e3-production-issues.md`](iteration-79-hermes-e3-production-issues.md) |
| **80** | **R3 计划逻辑补全** | `completePlanWithLogicalSteps`、[`iteration-80-hermes-r3-plan-reasoning.md`](iteration-80-hermes-r3-plan-reasoning.md) |
| **81** | **E4 顾问芯片扩展** | 稀疏描述/节奏/断链修复、[`iteration-81-hermes-e4-advisor-chips.md`](iteration-81-hermes-e4-advisor-chips.md) |
| **82** | **T3 Skills 深化** | 评分匹配、模板联动、`hermesSkillPlan`、[`iteration-82-hermes-t3-skills-deep.md`](iteration-82-hermes-t3-skills-deep.md) |
| **83** | **E2 版本链 Agent 联动** | 预快照、上下文 diff、主动「版本对比」、[`iteration-83-hermes-e2-version-agent.md`](iteration-83-hermes-e2-version-agent.md) |
| **84** | **T1 Registry 深化** | 风险/gate/参数、`isPlanStepAllowed`、[`iteration-84-hermes-t1-registry-deep.md`](iteration-84-hermes-t1-registry-deep.md) |
| **85** | **多 Job 编排（队列）** | 优先级/插队/取消排队、[`iteration-85-hermes-m2-multi-job-orchestration.md`](iteration-85-hermes-m2-multi-job-orchestration.md) |
| **86** | **R5 LibTV 面板分组** | 工作流主/高级 Tab、三区段标签、[`iteration-86-r5-libtv-panel-grouping.md`](iteration-86-r5-libtv-panel-grouping.md) |
| **87** | **R5 Seedance 轮询** | 多字段 URL 解析、[`iteration-87-r5-seedance-poll.md`](iteration-87-r5-seedance-poll.md) |
| **88** | **参考视频 ffprobe** | 非真理解、[`iteration-88-reference-video-metadata.md`](iteration-88-reference-video-metadata.md) |
| **89** | **产品状态矩阵** | [`PRODUCT_STATUS_MATRIX.md`](../product/PRODUCT_STATUS_MATRIX.md)、[`EPIC_STAGE5_BACKLOG.md`](../product/EPIC_STAGE5_BACKLOG.md) |
| **90** | **R5 视频模型测试连接** | `test_video_model_connection`、[`iteration-90-r5-video-model-test.md`](iteration-90-r5-video-model-test.md) |
| **91** | **E5 批量出关键帧** | `assessBatchImageReadiness`、[`iteration-91-e5-batch-keyframes.md`](iteration-91-e5-batch-keyframes.md) |
| **92** | **E5 重试失败关键帧** | `listFailedKeyframeBeatIds`、[`iteration-92-e5-retry-failed-keyframes.md`](iteration-92-e5-retry-failed-keyframes.md) |
| **94** | **连线内联删除** | 单线选中 + 沿路径删除钮、[`iteration-94-canvas-edge-inline-delete.md`](iteration-94-canvas-edge-inline-delete.md) |
| **93** | **Hermes image.retry_failed** | 对齐 iter-92、[`iteration-93-hermes-image-retry-failed.md`](iteration-93-hermes-image-retry-failed.md) |
| **95** | **黄金路径 P0/P1 巩固** | E2E 步骤 1 + P0/P1 文档 · [`iteration-95-golden-path-p0-p1.md`](iteration-95-golden-path-p0-p1.md) ✅ |
| **57** | **I3 主动补全**：侧栏芯片 + Situation 可点执行 | `hermesProactiveSuggestions.ts`、[`iteration-57-hermes-proactive-completion.md`](iteration-57-hermes-proactive-completion.md) |
| **58** | **G5 多格式导出**：MP4 / MOV / WebM + Hermes 格式话术 | `timelineExportFormat.ts`、`compose_concat.rs`、[`iteration-58-g5-multi-format-export.md`](iteration-58-g5-multi-format-export.md) |
| **59** | **导出编码面板**：分辨率 + 码率预设 | `timelineExportEncode.ts`、[`iteration-59-compose-export-encode-panel.md`](iteration-59-compose-export-encode-panel.md) |
| **60** | **ProRes / GIF 导出** | `exportFormat` 字段、[`iteration-60-prores-gif-export.md`](iteration-60-prores-gif-export.md) |

**iter-53 行为契约**（`agentLoopEnabled` 默认开，设置 → Agent →「步内智能调整」）：

- 执行 `video.generate_for_beats` 前若缺关键帧 → 自动插入 `image.generate_for_beats`
- 执行出图/出视频前若缺分镜 → 插入 `script.generate_storyboard`
- 可重试步骤失败 → 规则 `proposeFailureRecoveryPlan` 插入修复步（最多 3 轮 replan，单 Job 最多 12 步）
- 关 loop → 回退 iter-47 固定计划顺序 + 侧栏二次 recovery
- `workstate` 记录 `loopRound`、`lastToolSummary`；侧栏进度行 `↻ 重新规划：…`

### 4.9 C.1 节点状态机（2026-05-07 实现）

#### 4.9.1 节点状态类型

新增类型定义（`src/lib/types.ts`）：

```typescript
export type NodeExecutionStatus = "idle" | "pending" | "running" | "succeeded" | "failed" | "skipped";

export type NodeStatus = {
  status: NodeExecutionStatus;
  updatedAt: number;
  agentName?: string;
  phase?: string;
  error?: string;
  progress?: number;
};
```

`FlowNodeData` 新增可选字段：`status?: NodeStatus`

#### 4.9.2 状态监听 Hook

新增 `src/hooks/useNodeStatus.ts`：

- **`useNodeStatus(nodeId)`**：单节点状态读写
- **`useNodeStatusListener()`**：全局事件监听，自动将 Agent phase 映射为执行状态

#### 4.9.3 状态徽章组件

新增 `src/components/nodes/NodeStatusBadge.tsx`：

- 集成到 `NodeFrame` 标题栏
- 支持状态：idle（隐藏）、pending（灰）、running（蓝+脉冲）、succeeded（绿）、failed（红）、skipped（灰）

CSS 样式新增：`.nodeStatus*` 系列类名，动画效果

### 4.10 C.2 失败策略 + C.3 子图重跑（确认已实现）

#### C.2 失败策略 ✅

**后端（`src-tauri/src/executor/engine.rs`）**：
- 节点失败时自动将下游标记为 `skipped`（`downstream_descendants`）
- `abort_workflow_on_failure` 配置控制是否中断整图

**前端（`src/components/SettingsPanel.tsx`）**：
- `abortWorkflowOnFailure` 开关已存在

**UI（`src/components/RunPanel.tsx`）**：
- 显示失败节点列表
- 显示跳过原因统计

#### C.3 子图重跑 ✅

**后端**：`run_subgraph_inner` 函数支持从指定节点重跑，force 参数强制重跑已成功节点

**前端（`src/store/projectWorkflowRuns.ts`）**：
- `rerunFailedSubgraphImpl`：重跑失败子图
- `runNodeSubgraphImpl`：从指定节点重跑

**UI（`src/components/RunPanel.tsx`）**：
- "重跑失败子图"按钮

---

## 5. 已知缺口与技术债（异地开发易踩坑）

| 主题 | 说明 |
|------|------|
| 视频任务引擎（R4/R5） | ✅ `video_cmd.rs` 三命令 + HTTP 轮询（iter-87 多字段解析）；**仅 `mock_` jobId** 降级 ffmpeg 黑屏片。需配置 Settings 视频模型 Key。 |
| R4 分镜产品化 | ~~pending~~ ✅ 已实现（2026-05-07）。增强分镜网格状态、批量重试、Hermes 串联。 |
| C.1 节点状态机 | ~~pending~~ ✅ 已实现（2026-05-07）。`node.data.status` 字段、全局事件监听、状态徽章 UI。 |
| C.2 失败策略 | ~~pending~~ ✅ 已存在。后端自动标记下游 skipped，`abortWorkflowOnFailure` 配置。 |
| C.3 子图重跑 | ~~pending~~ ✅ 已存在。后端 `run_subgraph_inner`，前端"重跑失败子图"按钮。 |
| 设计 vs 实现差距 | `architecture-spec-vs-implementation.md`：端口类型系统、DAG 并行、执行器只认 asset ID 等仍为 ⚠️/❌。 |
| 参考视频与多模态 | iter-88：**路径 + ffprobe 元信息**（非画面理解）；真理解 → Epic E2（见 [`EPIC_STAGE5_BACKLOG.md`](../product/EPIC_STAGE5_BACKLOG.md)）。 |
| `global.css` 体积 | 单文件过大，长期建议按模块拆分（非功能阻断）。 |
| `ScriptNodeWorkbench.tsx` | 体量大，后续可拆子组件或抽 hooks（非功能阻断）。 |

---

## 5.1 外部启发（LibTV / OpenClaw 思路）与可补强点

参考文档（本地）：`liblib-tv-analysis.md`（2026-04-28）

### 关键启发（对 canvasflow 有直接价值的部分）

- **双入口架构**：人类入口（无限画布）+ Agent 入口（Skill API / OpenClaw）。  
  - 对应到本项目：我们已有画布入口；可以补一个“Agent/Skill 调度层”作为 **R7 能力编排层**的落地点（不是替代现有 DAG，而是包装成可观测的任务）。
- **API 优先 + 本地增强可选**：默认走云端 API（只需 key），本地 ComfyUI / Ollama 作为“可选增强”。  
  - 对应到本项目：现状已偏 API 优先；建议在设置里把“可选本地增强”做成独立分组（探测/连通性测试/启用开关），避免与主线耦合。
- **视频生成=异步任务 + 轮询**：主流视频 API 都是 task_id → poll → 下载落盘。  
  - 对应到本项目：若要把视频节点“工程化”，需要把轮询/重试/取消/下载落盘做成统一任务（并落库 run_events）。
- **生成 URL 过期**：图片/视频 URL 可能 1 小时内失效，必须及时下载到本地资产库。  
  - 对应到本项目：资产协议建议以 `assetId`/本地路径为真源，URL 仅作为短暂传输。
- **更新体系**：`tauri-plugin-updater` + GitHub Release + 签名，形成可控的发布闭环。  
  - 对应到本项目：属于“资产与质量层”，可列为独立里程碑（不挡主线功能，但很利于分发与异地协作）。

### 建议补充优化（按投入产出排序）

1. **（高）统一“视频任务”执行模型**：提交→轮询→下载→入库→回写节点 data，并写 run_events（进度/错误/重试次数）。  
2. **（高）设置页补“连通性测试/超时/重试”**：Provider 除 enabled/priority 外，建议支持 timeout、maxRetries，并提供“测试”按钮。  
3. **（中）本地增强探测**：ComfyUI / Ollama 作为可选，做“检测/启用”而非强依赖。  
4. **（中）Agent/Skill API 预留**：把“OpenClaw/Hermes”这类 Agent 集成点抽象为 adapter（CLI/本地服务/远程 API），并与 runs.db 事件流打通。  
5. **（中）自动更新**：接入 updater，补一份发布与签名备份说明，降低版本分发成本。  

> 注：以上 1/2/4 与 `architecture-spec-vs-implementation.md` 中的“能力编排层/可观测/容错”方向一致；建议优先围绕“任务状态 + 日志 + 重试”做纵向打穿。

## 6. 下一步开发规划（建议顺序）

以下为**建议优先级**，可按人力拆 PR；每轮仍建议遵守 `ROADMAP_V2` 的「单核目标 + 验收步骤」。

### P0 — 生产链路「可感知闭环」 ✅ 已完成

1. **~~R4 分镜侧产品化~~** ✅ 已实现（2026-05-07）
   - 分镜网格状态增强、批量重试、Hermes 串联按钮

2. **~~C.1 节点状态机~~** ✅ 已实现（2026-05-07）
   - `node.data.status` 字段、全局事件监听、状态徽章 UI

3. **~~C.2 失败策略~~** ✅ 已存在
   - 后端自动标记下游 skipped，`abortWorkflowOnFailure` 配置

4. **~~C.3 子图重跑~~** ✅ 已存在
   - 后端 `run_subgraph_inner`，前端"重跑失败子图"按钮

5. **~~视频异步任务引擎~~** ✅ 已实现（2026-05）
   - `video_gen_start` / `video_gen_get_job` / `video_gen_cancel` 三命令已完成
   - **`poll_video_job_http`**：iter-87 已接 HTTP 多字段解析；**仅 `mock_` jobId** 仍降级 ffmpeg 黑屏片（见 §5 表）

### P0′ — 黄金路径巩固 ✅（iter-95，2026-05-26）

- E2E 4 条（含浏览器「新建工程」桌面壳提示）；`GOLDEN_PATH` / `RELEASE_CHECKLIST` P0/P1 与双路径表。  
- B 档步骤 2、9、10 仍手工（桌面）；发版前按 [`GOLDEN_PATH.md`](../product/GOLDEN_PATH.md) 勾选。

### P1 — 脚本工作台与体验

**画布壳层 / LibTV 范式（已完成）** — [`iteration-15-canvas-chrome-libtv-parity.md`](iteration-15-canvas-chrome-libtv-parity.md)：15-0～D（IA、顶栏、Dock、空态、token 扫尾）。

0. **脚本节点 Chrome + 体验一致（已完成）**  
   - Chrome：`iteration-08`（`MinimalScriptNode` + Portal）。  
   - 对齐：`script-09-0A/0B`、`script-10-1A/1B`（见本文 §4.2 表）。  
   - **发版前优先**：iter-95 黄金路径 P0/P1；Epic / R5/R6 深化见 [`脚本节点开发顺序.md`](../product/脚本节点开发顺序.md) §10。

1. **Workbench 可维护性**（非功能阻断）
   - 拆分 `ScriptNodeWorkbench.tsx` 或提取批量/模板逻辑到 `src/lib/`。

2. **样式拆分**
   - 从 `global.css` 抽出脚本工作台 / 画布浮层等 scoped 片段，减少合并冲突。

### P2 — 架构纵轴（2026-05-21 收尾并冻结）

3. **执行器与资产 ID** — ✅ **已冻结**（[`iteration-17-asset-id-dag-vertical.md`](iteration-17-asset-id-dag-vertical.md) §0）  
   - 够用：打开工程 reconcile、`commitNodeMediaPatch`、解析优先 `assetId`  
   - **不再做** M5（删 `path`）、新 reconcile 分支

4. **视频节点参数分组 / 失败态固定区域** — ✅（`iteration-16-r5-video-generation-panel.md`）
   - `VideoGenerationStatusRail`、分区标签、`VideoOutputSettingsContent`「时长与水印」

### P3 — 时间线合成与导出（2026-05-21 收尾并冻结）

5. **时间线合成与导出闭环** — ✅ 已冻结（[`iteration-18-p3-timeline-export.md`](iteration-18-p3-timeline-export.md)）  
   - 已有全屏 `ComposeEditorOverlay`；本迭代补：从脚本填充、Inspector/底栏进剪辑台、导出 `assetId` 双写  
   - **不再做**：多轨/转场、重做时间线 UI

### P4 — 工作流库（画布复用，已合并）

6. **工作流库 P0** — ✅ 已合并进 `feat/hermes-p2-agent-experience`（[`iteration-96-workflow-library.md`](iteration-96-workflow-library.md)；PR 栈 `feat/iter-96-workflow-a` → `b` → `c`）  
   - 本机 `localStorage` + 工程 `.canvasflow/workflows`；多选/分组/右键「保存为工作流」；Dock 列表插入/删除  
   - 依赖：`canvasGroupTemplate` / 粘贴 ID 映射；与分组工具箱并存  
   - 后续：iter-97 导入导出；iter-98 标签/缩略图/Hermes 提示  

### P5 — 其他（按需）

7. 产品向迭代（脚本/分镜体验、真实 video API、性能）— 无固定排期

---

## 7. 关键代码索引（按主题）

| 主题 | 路径 |
|------|------|
| 画布与菜单 | `src/components/FlowCanvas.tsx`、`src/components/canvas/CanvasContextMenus.tsx`、`src/components/canvas/menuConstants.ts` |
| 工程状态 | `src/store/projectStore.ts` |
| 类型与序列化 | `src/lib/types.ts`（含 `NodeExecutionStatus`、`NodeStatus`）、`src/lib/serialization.ts` |
| 脚本分镜数据 | `src/lib/scriptBeatHelpers.ts`、`src/lib/incomingScriptBinding.ts`、`src/lib/scriptStoryboardScope.ts` |
| 脚本画布 Chrome | `src/components/nodes/MinimalScriptNode.tsx`、`ScriptComposerPanel*.tsx`、`ScriptPreviewToolbar*.tsx`、`src/lib/scriptNodeCanvasEntries.ts` |
| 脚本全屏 / 表 | `src/components/ScriptNodeFullscreenOverlay.tsx`、`src/components/ScriptBeatsEditorTable.tsx` |
| 脚本工作台 | `src/components/ScriptNodeWorkbench.tsx`、`src/components/ScriptWorkbench*.tsx` |
| 脚本 Agent / Provider | `src/lib/nodeAgentRuntime/scriptWorkbenchAgent.ts`、`dagnodeDispatchAgents.ts`、`scriptStoryboardAgent.ts`、`src/lib/scriptNodeLlmParams.ts` |
| 分镜网格 | `src/components/ScriptStoryboardSection.tsx`（R4 产品化） |
| 旧卡内 UI（未注册） | `src/components/nodes/ScriptNode.tsx`（仅历史参考，勿按此实现） |
| 节点状态 | `src/hooks/useNodeStatus.ts`（C.1）、`src/components/nodes/NodeStatusBadge.tsx` |
| Hermes 自动串联 | `src/lib/hermes/index.ts`、`src/lib/hermes/autoChain.ts`、`src/lib/hermes/shotNodeFactory.ts` |
| Hermes Director / Agent loop | `src/lib/hermes/hermesDirector.ts`、`src/lib/hermes/agent/hermesAgentLoop.ts`、`src/lib/hermes/agent/hermesJobStore.ts`、`src/components/hermes/HermesSidebar.tsx` |
| 视频生成面板 R5 | `src/components/nodes/VideoMultimodalInputPanel.tsx`、`VideoGenerationStatusRail.tsx`、`VideoOutputSettingsContent.tsx` |
| 资产 ID 纵轴 M2 | `src-tauri/src/canvas_asset_backfill.rs`、`executor/asset_resolve.rs`、`src/lib/nodeMediaRef.ts`、`projectWorkspaceLoad.ts` |
| 剪辑 / 导出 P3 | `ComposeEditorOverlay.tsx`、`useComposeNodeEditor.ts`、`findScriptForCompose.ts`、`composeExportCommit.ts` |
| 侧栏 | `src/components/Inspector.tsx` |
| DAG 执行 | `src-tauri/src/executor.rs`、`src-tauri/src/executor/engine.rs` |
| 运行事件 / DB | `src-tauri/src/db.rs`（及与 `run_events` 相关调用） |
| **视频生成** | `src-tauri/src/commands/video_cmd.rs`（三命令）、`src/lib/videoGeneration/mode.ts`（模式开关）、`src/lib/videoGeneration/bridge.ts`（路由）、`src/lib/videoGeneration/apiPool.ts`（mock client）、`src/hooks/useVideoNodeGeneration.ts` |
| **测试基础设施** | `vitest.config.ts`（jsdom 环境）、`vitest.setup.ts`（jest-dom 全局） |
| **质量门禁** | `CONTRIBUTING.md` §6、`RELEASE_CHECKLIST.md`、`README.md` 质量门禁节 |
| **黄金路径 P0/P1** | [`GOLDEN_PATH.md`](../product/GOLDEN_PATH.md)、[`iteration-95-golden-path-p0-p1.md`](iteration-95-golden-path-p0-p1.md)、`e2e/golden-path.spec.ts` |
| **工作流库 iter-96** | [`iteration-96-workflow-library.md`](iteration-96-workflow-library.md)、`canvasWorkflowSnapshot.ts`、`CanvasWorkflowLibrarySection.tsx`、`projectWorkflowProduction.ts` |

---

## 8. 验收与 QA 文档（小白向）

- 总入口：[小白验收指南总入口（2026-04）](./小白验收指南_总入口_2026-04.md)  
- R3 等分轮清单：同目录下 `R3_QA_CHECKLIST_*`、`R3_小白验收操作指南_*` 等。

---

## 9. 异地协作建议

1. 开分支前先看本文 **§4 / §5**，避免重复实现已交付或已否决方案。  
2. 改执行器与前端契约时，**同时更新** `architecture-spec-vs-implementation.md` 或本文对应小节。  
3. 合并前必须通过质量门禁：`npm run quality:gate`（含 typecheck / lint / vitest 覆盖率 / rust test），或完整门禁 `npm run quality:gate:full`（含 E2E）。

---

*更新日期见文首；重大里程碑后在本文件追加小节或修订 §3～§6 即可。*
