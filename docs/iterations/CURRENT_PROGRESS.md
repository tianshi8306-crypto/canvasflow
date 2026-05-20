# 当前进度与下一步规划（异地协作）

> **固定入口**：本文档为「进度 + 规划 + 代码索引」的**主文档**，请在异地开发时优先阅读本文。  
> 更新日期：**2026-05-18**  
> 仓库：**vibevideo**（Tauri + React + React Flow）  
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

### UX 决策（无限画布方案，2026-05-18）

- **不采用** LibTV 式底部生成器 Dock。
- 图片 / 视频 / 音频：**节点外浮层**（Portal）+ Inspector 元数据；节点卡保持预览与生成分离（见 [`docs/图片节点设计.md`](../图片节点设计.md)）。
- 规范参考：[`docs/无限画布.pdf`](../无限画布.pdf)、[`docs/节点UI设计规范.txt`](../节点UI设计规范.txt)（色板/状态作 token 参考，不强制节点内算力条）。

---

## 2. 环境与运行约定

| 项 | 说明 |
|----|------|
| 桌面端 | `src-tauri` + `npm run tauri dev`（或项目既有脚本）；部分能力仅 Tauri 可用（文件对话框、密钥环、子图执行等）。 |
| 前端检查 | 仓库根目录：`npx tsc --noEmit` |
| 后端检查 | `src-tauri`：`cargo check` / `cargo test`（按需） |
| 全局样式 | 大量 UI 在 `src/styles/global.css`；画布浮层 token 为 `--canvas-float-*`（与顶栏、小地图等一致）。 |

---

## 3. 路线图位置（粗粒度）

按 `ROADMAP_V2.md` 的 R 划分，当前 **R1～R4 主体已落地，C.1/C.2/C.3 架构能力已实现**：

| 阶段 | 状态 | 说明 |
|------|------|------|
| R1 工程与保存 | 基本具备 | 工程 JSON、撤销重做、顶栏状态等。 |
| R2 五类节点画布体验 | 持续迭代 | 小地图、`F`/`Z` 视口、整理画布确认、图片浮层生成；无底部 Dock。 |
| R3 脚本工作台 | **主体可用** | 全屏表、批量操作、模板（localStorage）、角色列与缩略图上传等。 |
| R4 分镜 | **产品化完成** | `storyboardShots`、`ScriptStoryboardSection` + Hermes 自动串联、失败重试。 |
| R5 多模态输入 | **UI 已实现** | `VideoMultimodalInputPanel` 多模态输入面板，参数分组待完善。 |
| R6 时间线合成 | **基础实现** | `FFmpegConcatPanel` FFmpeg 拼接面板，时间轴编辑能力待完善。 |
| C.1 节点状态机 | ✅ 已实现 | 节点执行状态可见（idle/pending/running/succeeded/failed/skipped）。 |
| C.2 失败策略 | ✅ 已存在 | 后端自动标记下游 skipped，`abortWorkflowOnFailure` 配置。 |
| C.3 子图重跑 | ✅ 已存在 | 后端 `run_subgraph_inner`，前端"重跑失败子图"按钮。 |

---

## 4. 近期已实现（与主线强相关）

以下对应「脚本中枢 + 画布生产链路」近期交付，便于异地理解**行为契约**：

### 4.1 脚本节点解析与执行器（Rust）

- **输入来源放宽**：不再强制「必须连接上游文本节点」。  
  - 有上游剧本文本：仍按「解析要求 + 待解析剧本文本」双段拼进 LLM。  
  - 无上游、仅有上游 **videoNode** 路径：在 `executor.rs` 中收集参考视频路径，生成「待解析素材」说明块（纯文本模型无法真正「看视频」，提示中已说明可据元信息推断）。  
  - 无上游、无视频：**单框合写**——整段 `prompt` 作为「剧本文本与创作要求」一段输入。  
- **参考视频**：除前端连线外，**执行器从图结构读取** `videoNode.data.path`，与上游文本并存时追加「参考视频」块。  
- 关键文件：`src-tauri/src/executor.rs`（`run_script_node`、`incoming_reference_video_paths_ordered` 等）。

### 4.2 脚本节点前端（React）

- 解析按钮禁用逻辑与空状态提示已按「文本 / 视频 / 合写」调整。  
- 文件：`src/components/nodes/ScriptNode.tsx`。

### 4.3 侧栏 Inspector：镜头绑定

- 图片 / 音频 / 视频节点：在存在上游 `scriptNode` 且其有 `scriptBeats` 时，**`scriptBeatId` 以下拉列出镜头**（镜号 + 描述摘要）；选择时写入 `shotNumber`；未在列表中的已保存 id 保留「孤儿」选项。  
- 文件：`src/components/Inspector.tsx`。

### 4.4 脚本表格类型安全

- `ScriptBeatsEditorTable` 中 `TableColKey` 与 `ScriptBeatStringKey` 混用导致的 TS 报错，已通过 `fieldKey` 收窄修复。  
- 文件：`src/components/ScriptBeatsEditorTable.tsx`。

### 4.5 画布左键 / 右键添加菜单

- **左键双击空白**打开的「添加」面板，已与**空白处右键 → 添加节点**二级菜单对齐：同一 `canvasPaneCtxMenuRoot` + `PaneAddRow`（含图标）、宽度与右键二级一致（`contextPaneL2` / 图库页 `gallery`）。  
- 曾尝试「左键菜单去图标 + 紧凑尺寸」，已按产品要求**撤销**，当前即上述对齐版。  
- 文件：`src/components/canvas/CanvasContextMenus.tsx`、`src/components/canvas/menuConstants.ts`、`src/components/FlowCanvas.tsx`。

### 4.6 依赖与清理

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
| 视频任务引擎（R4/R5） | ~~pending~~ ✅ 已实现（`video_cmd.rs` 三命令 + 两阶段 poll + ffmpeg mock fallback）。真实 API 轮询（`poll_video_job_http`）仍为 stub，待接入 Doubao Seedance API。 |
| R4 分镜产品化 | ~~pending~~ ✅ 已实现（2026-05-07）。增强分镜网格状态、批量重试、Hermes 串联。 |
| C.1 节点状态机 | ~~pending~~ ✅ 已实现（2026-05-07）。`node.data.status` 字段、全局事件监听、状态徽章 UI。 |
| C.2 失败策略 | ~~pending~~ ✅ 已存在。后端自动标记下游 skipped，`abortWorkflowOnFailure` 配置。 |
| C.3 子图重跑 | ~~pending~~ ✅ 已存在。后端 `run_subgraph_inner`，前端"重跑失败子图"按钮。 |
| 设计 vs 实现差距 | `architecture-spec-vs-implementation.md`：端口类型系统、DAG 并行、执行器只认 asset ID 等仍为 ⚠️/❌。 |
| 参考视频与多模态 | 当前为「路径 + 文本约束」；若产品要**真视频理解**，需单独方案（模型与成本）。 |
| `global.css` 体积 | 单文件过大，长期建议按模块拆分（非功能阻断）。 |
| `ScriptNodeWorkbench.tsx` | 体量大，后续可拆子组件或抽 hooks（非功能阻断）。 |

---

## 5.1 外部启发（LibTV / OpenClaw 思路）与可补强点

参考文档（本地）：`liblib-tv-analysis.md`（2026-04-28）

### 关键启发（对 vibevideo 有直接价值的部分）

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
   - 真实 API 轮询（`poll_video_job_http`）仍为 stub，待接入 Doubao Seedance API

### P1 — 脚本工作台与体验

1. **Workbench 可维护性**
   - 拆分 `ScriptNodeWorkbench.tsx` 或提取批量/模板逻辑到 `src/lib/`。

2. **样式拆分**
   - 从 `global.css` 抽出脚本工作台 / 画布浮层等 scoped 片段，减少合并冲突。

### P2 — 架构纵轴（与对照表一致，改动面大）

3. **执行器与资产 ID**
   - 按 `architecture-spec-vs-implementation.md` 结论，选一纵轴：**DAG 内更多只认 `assetId` + 元数据表**，再扩端口类型。
   - 需单独里程碑文档与迁移策略（旧工程兼容）。

4. **视频节点参数分组 / 失败态固定区域**
   - R5 视频生成参数面板完善

### P3 — 路线图后续 R5～R6

5. 时间线合成与导出闭环
   - 增强现有 `ffmpegConcat` 能力，添加时间轴编辑 UI

---

## 7. 关键代码索引（按主题）

| 主题 | 路径 |
|------|------|
| 画布与菜单 | `src/components/FlowCanvas.tsx`、`src/components/canvas/CanvasContextMenus.tsx`、`src/components/canvas/menuConstants.ts` |
| 工程状态 | `src/store/projectStore.ts` |
| 类型与序列化 | `src/lib/types.ts`（含 `NodeExecutionStatus`、`NodeStatus`）、`src/lib/serialization.ts` |
| 脚本分镜数据 | `src/lib/scriptBeatHelpers.ts`、`src/lib/incomingScriptBinding.ts` |
| 脚本节点 UI | `src/components/nodes/ScriptNode.tsx`、全屏 `ScriptNodeFullscreenOverlay.tsx`（若存在） |
| 脚本工作台 | `src/components/ScriptNodeWorkbench.tsx`、`src/components/ScriptBeatsEditorTable.tsx` |
| 分镜网格 | `src/components/ScriptStoryboardSection.tsx`（R4 产品化） |
| 节点状态 | `src/hooks/useNodeStatus.ts`（C.1）、`src/components/nodes/NodeStatusBadge.tsx` |
| Hermes 自动串联 | `src/lib/hermes/index.ts`、`src/lib/hermes/autoChain.ts`、`src/lib/hermes/shotNodeFactory.ts` |
| 侧栏 | `src/components/Inspector.tsx` |
| DAG 执行 | `src-tauri/src/executor.rs`、`src-tauri/src/executor/engine.rs` |
| 运行事件 / DB | `src-tauri/src/db.rs`（及与 `run_events` 相关调用） |
| **视频生成** | `src-tauri/src/commands/video_cmd.rs`（三命令）、`src/lib/videoGeneration/mode.ts`（模式开关）、`src/lib/videoGeneration/bridge.ts`（路由）、`src/lib/videoGeneration/apiPool.ts`（mock client）、`src/hooks/useVideoNodeGeneration.ts` |
| **测试基础设施** | `vitest.config.ts`（jsdom 环境）、`vitest.setup.ts`（jest-dom 全局） |
| **质量门禁** | `CONTRIBUTING.md` §6、`RELEASE_CHECKLIST.md`、`README.md` 质量门禁节 |

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
