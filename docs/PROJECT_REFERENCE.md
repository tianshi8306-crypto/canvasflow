# CanvasFlow AI Studio - 项目参考手册

> 本文件是开发参考手册，涵盖架构决策、技术栈、代码约定和核心概念。开发功能前必读。

---

## 1. 技术栈速查

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18.3.1 + Vite 5.4.14 |
| 画布引擎 | @xyflow/react (ReactFlow) 12.4.2 |
| 状态管理 | Zustand 5.0.3 |
| 桌面框架 | Tauri 2.x + @tauri-apps/api 2.2.0 |
| 后端语言 | Rust (Edition 2021) |
| HTTP客户端 | reqwest (Rust) |
| 数据库 | rusqlite (bundled SQLite) |
| 语言 | TypeScript 5.6.3 (strict mode) |
| 测试 | Vitest + Playwright |

---

## 2. 目录结构

```
src/
├── App.tsx                        # 应用入口、键盘快捷键、Hermes 初始化
├── components/
│   ├── FlowCanvas.tsx            # ReactFlow 画布核心
│   ├── AppTopBar.tsx            # 顶部栏
│   ├── RunPanel.tsx             # 运行面板
│   ├── Inspector.tsx            # 属性面板
│   ├── LeftAddDock.tsx          # 左侧添加面板
│   ├── nodes/                   # 节点类型组件（PascalCase）
│   │   ├── TextNode.tsx
│   │   ├── LLMNode.tsx
│   │   ├── ImageAssetNode.tsx
│   │   ├── VideoAssetNode.tsx
│   │   ├── AudioAssetNode.tsx
│   │   ├── ScriptNode.tsx
│   │   ├── FFmpegNode.tsx
│   │   └── GroupNode.tsx
│   ├── canvas/                  # 画布 UI 组件
│   │   ├── CanvasFlowChrome.tsx     # 画布顶栏（撤销/重做等）
│   │   ├── CanvasContextMenus.tsx  # 右键菜单
│   │   ├── ZoomControls.tsx        # 缩放控制器
│   │   ├── MarkerToolbar.tsx       # 节点标记工具栏
│   │   └── NodeMaximizedOverlay.tsx
│   └── ...
├── store/                       # Zustand 状态管理
│   ├── projectStore.ts          # 项目状态（节点/边/视口/运行）⚠️ 真相来源
│   ├── canvasUiStore.ts         # UI 状态（面板/对话框/全屏）
│   ├── projectHistory.ts         # 撤销/重做
│   ├── projectStoreTypes.ts      # projectStore 的 TypeScript 类型
│   └── projectWorkflowRuns.ts   # 工作流执行记录
├── lib/                         # 核心业务逻辑
│   ├── types.ts                 # FlowNodeData, ScriptBeat, StoryboardShot, NodeStatus 等核心类型
│   ├── canvasNodeDefaults.ts     # 各节点类型默认数据
│   ├── flowConnectionPolicy.ts   # 连线类型校验规则
│   ├── videoNodeTypes.ts        # 视频节点领域模型（VideoGenerationWorkflow 等）
│   ├── videoGeneration/         # 视频生成相关
│   │   ├── bridge.ts            # Tauri 命令桥接层
│   │   ├── apiPool.ts           # API 类型定义
│   │   └── catalog.ts            # 模型目录和工作流 Tab 定义
│   ├── hermes/                  # Hermes 自动串联
│   │   ├── autoChain.ts         # 核心联动逻辑
│   │   └── shotNodeFactory.ts    # 分镜节点对创建
│   ├── nodeAgentRuntime/        # Agent 运行时
│   │   ├── runNodeTaskAgent.ts  # 统一调度器（sense→execute→validate→commit）
│   │   ├── scriptWorkbenchAgent.ts
│   │   ├── scriptStoryboardAgent.ts
│   │   ├── videoGenerationAgent.ts
│   │   ├── imageGenerationAgent.ts
│   │   └── videoAsyncTaskAgent.ts
│   ├── seedance/               # Doubao Seedance API
│   │   ├── api.ts
│   │   ├── types.ts
│   │   └── validation.ts
│   └── incomingScriptBinding.ts # 脚本节点绑定
├── hooks/                       # React Hooks
│   ├── useVideoNodeGeneration.ts # 视频生成轮询
│   ├── useVideoModels.ts         # 视频模型列表
│   ├── useVideoIncomingReferenceItems.ts # 连入视频节点的参考素材
│   └── useTtvDraft.ts           # 视频生成草稿管理
├── shared/api/                   # API 调用封装
│   ├── assets.ts               # 素材相关
│   └── runs.ts                 # 运行日志
└── styles/
    └── global.css              # 全局样式

src-tauri/src/
├── main.rs                      # Windows 入口
├── lib.rs                       # Tauri 应用配置/命令注册
├── commands/                   # Tauri 命令处理
│   ├── project_cmd.rs          # 项目操作（pick/open/save）
│   ├── graph_cmd.rs            # 图执行
│   ├── settings_cmd.rs         # 设置
│   ├── runs_cmd.rs             # 运行日志
│   ├── video_cmd.rs            # 视频生成（调用 Doubao API）
│   ├── file_cmd.rs             # 文件 Base64 编码
│   └── ffmpeg_cmd.rs          # FFmpeg 合成
└── executor/                    # 执行引擎
    ├── graph_flow.rs           # DAG 执行引擎
    ├── llm.rs                  # LLM 调用
    └── ffmpeg.rs               # 视频合成
```

---

## 3. 核心类型（必须熟记）

### 3.1 FlowNodeData（所有节点共享数据结构）

```typescript
type FlowNodeData = {
  label?: string;
  prompt?: string;
  params?: Record<string, unknown>;
  path?: string;         // 资产路径（图片/视频/音频）
  assetId?: string;       // 素材库 ID
  video?: VideoNodePersisted;     // 视频节点专用
  inputs?: string[];             // ffmpegConcat 专用
  scriptBeats?: ScriptBeat[];    // scriptNode 专用
  storyboardShots?: StoryboardShot[]; // 分镜结果
  status?: NodeStatus;           // 节点执行状态
  cameraMovement?: CameraMovement; // 运镜参数
};
```

### 3.2 NodeStatus（节点执行状态机）

```typescript
type NodeStatus = {
  status: "idle" | "pending" | "running" | "succeeded" | "failed" | "skipped";
  agentName?: string;
  phase?: string;
  error?: string;
  progress?: number;
  retryCount?: string;
};
```

### 3.3 ScriptBeat（镜头/节拍）

```typescript
type ScriptBeat = {
  id: string;
  shotNumber: string;       // 镜头号 "1.1"
  durationHint: string;     // 时长提示
  description: string;     // 镜头描述
  character1: string;      // 角色名
  character1Desc: string;  // 角色描述
  character1Image: string; // 参考图
  character2: string;
  character2Desc: string;
  character2Image: string;
  cameraAngle: string;     // 景别
  cameraMovement: string;  // 运镜
  dialogue: string;        // 台词
  music: string;           // 配乐
  visualPrompt: string;    // AI 生成分镜描述
  imagePath?: string;      // 分镜图路径
  videoStatus?: VideoShotStatus;  // 视频生成状态
  videoError?: string;
  videoNodeId?: string;    // 关联的视频节点 ID
};
```

### 3.4 VideoGenerationWorkflow（视频工作流类型）

```typescript
type VideoGenerationWorkflow =
  | "text_to_video"         // 文生视频
  | "multimodal_reference"  // 全能参考
  | "image_to_video"        // 图生视频
  | "first_last_frame"      // 首尾帧
  | "image_reference"       // 图片参考
  | "video_reference"       // 参考视频
  | "video_edit"            // 视频编辑
  | "video_extend";         // 视频延伸
```

### 3.5 连线类型（PortType）

```typescript
type PortType = "text" | "image" | "video" | "audio" | "script";
```

---

## 4. 连线策略规则（flowConnectionPolicy.ts）

目标节点接受的输入类型：

| 目标节点 | 接受的 PortType |
|---------|----------------|
| llm | text, script |
| textNode | text, script |
| imageNode | text, script |
| videoNode | image, video, audio, text, script（最宽松） |
| audioNode | text, script |
| ffmpegConcat | video（最严格） |
| scriptNode | script |
| group | 全部 |

连线时通过 `validateConnection()` + `isConnectionAllowed()` 校验。

---

## 5. 节点注册（FlowCanvas.tsx）

```typescript
const nodeTypes = {
  llm: LLMNode,
  mediaImport: MediaImportNode,
  imageAsset: ImageAssetNode,    // imageNode 共用
  ffmpegConcat: FFmpegNode,
  textNode: TextNode,
  scriptNode: ScriptNode,
  videoNode: VideoAssetNode,      // videoNode 共用
  audioNode: AudioAssetNode,
  group: GroupNode,
} satisfies NodeTypes;
```

---

## 6. 状态管理模式

### 6.1 projectStore（唯一真相来源）

- **所有画布数据**：`nodes[]`, `edges[]`, `viewport`
- **项目状态**：`projectPath`, `isGraphRunning`
- **选择状态**：`selectedNodeId`, `selectedNodeIds[]`, `selectedEdgeIds[]`
- **运行状态**：`nodeRunStateById`

**更新节点数据的正确方式**：
```typescript
const updateNodeData = useProjectStore((s) => s.updateNodeData);
// ...
updateNodeData(nodeId, { path: newPath }); // 浅合并到 data
```

### 6.2 canvasUiStore（纯 UI 状态）

- `maximizedNodeId` - 全屏节点
- `audioTtsPanelNodeId` - TTS 面板
- `minimapVisible` - 小地图显隐
- `markedNodeId` - 标记的节点（用于快速定位）

---

## 7. Tauri 命令调用模式

### 7.1 前端调用

```typescript
import { invoke } from "@tauri-apps/api/core";

// 调用格式
const result = await invoke<ReturnType>("command_name", { arg1, arg2 });
```

### 7.2 常用命令速查

| 命令 | 用途 |
|------|------|
| `pick_project_folder` | 选择工程目录 |
| `read_canvasflow_json` | 读取画布数据 |
| `write_canvasflow_json` | 保存画布数据 |
| `execute_graph` | 执行整图 |
| `execute_subgraph` | 执行子图 |
| `video_gen_start` | 提交视频生成任务 |
| `video_gen_get_job` | 轮询视频生成状态 |
| `video_gen_cancel` | 取消视频任务 |
| `read_file_as_base64` | 读取文件并 Base64 编码 |
| `list_assets` | 列出素材 |

### 7.3 Rust 命令注册

在 `src-tauri/src/lib.rs` 中注册：
```rust
invoke_handler(tauri::generate_handler![
    commands::settings_cmd::load_settings,
    commands::project_cmd::read_canvasflow_json,
    commands::video_cmd::video_gen_start,
    // ...
])
```

---

## 8. Agent 运行时架构

### 8.1 统一调度器模式

```typescript
// sense → execute → validate → commit
export async function runNodeTaskAgent(
  runtime: NodeTaskAgentRuntime<TInput, TSensed, TExecuted, TCommitted>,
  input: TInput,
  ctx: NodeAgentContext,  // { nodeId, projectPath, updateNodeData, setStatusText }
): Promise<TCommitted>
```

### 8.2 事件流

每个 phase 变化都通过 `window.dispatchEvent` 广播：
```typescript
window.dispatchEvent(
  new CustomEvent("node-agent-event", {
    detail: { sessionId, nodeId, agentName, phase, data }
  })
);
```

App.tsx 监听此事件并：
1. 持久化到 SQLite（`append_node_agent_event`）
2. 更新 `lastRunId` 到 store

### 8.3 主要 Agent

| Agent | 用途 |
|-------|------|
| `scriptWorkbenchAgent` | 根据主题生成脚本 |
| `scriptStoryboardAgent` | 将脚本解析为 StoryboardShot[] |
| `videoGenerationAgent` | 调用 Doubao Seedance API 生成视频 |
| `imageGenerationAgent` | 图片生成 |
| `audioTtsAgent` | 文字转语音 |

---

## 9. Hermes 自动串联

监听 `node-agent-event`，自动完成：

1. **scriptNode 完成后** → 为每个 `storyboardShot` 创建 `imageNode + videoNode` 配对
2. **videoNode 完成后** → 联动更新 `storyboardShot.videoStatus`

关键注册表：
```typescript
const shotNodeRegistry = new Map<string, {
  scriptNodeId: string;
  scriptBeatId: string;
}>();
```

---

## 10. 视频生成流程

### 10.1 前端触发链

```
用户点击发送
  → useVideoNodeGeneration.startGeneration()
    → runNodeTaskAgent(videoGenerationAgentRuntime, { videoBlock })
      → 前端 video_gen_start Tauri 调用
        → Rust submit_video_job_http() 提交到 Doubao
          → 返回 job_id
      → 前端开始轮询 getVideoJobViaBridge(job_id)
        → Rust poll_video_job_http() 查询状态
          → 成功 → download_video_to_assets() 下载视频
          → 返回 result_rel_path
      → 前端 updateNodeData(nodeId, { path: result_rel_path })
```

### 10.2 API 响应结构（已修复）

```json
{
  "model": "doubao-seedance-2-0-260128",
  "status": "succeeded",
  "content": { "video_url": "https://..." },
  ...
}
```

**关键路径**：
- `status` → 根级别（不是 `/data/status`）
- `video_url` → `/content/video_url`（不是 `/data/result/video_url`）

### 10.3 Base64 媒体编码

本地文件通过 `read_file_as_base64` 读取后转 Data URL：
```
data:image/png;base64,{base64_content}
data:video/mp4;base64,{base64_content}
```

---

## 11. 代码约定

### 11.1 TypeScript 严格模式

- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noImplicitReturns: true`

### 11.2 组件模式

```typescript
// 使用 memo 优化重渲染
export const SomeNode = memo(function SomeNode({ id, data }) {
  // 使用浅比较的选择器
  const { selectedNodeIds } = useProjectStore((s) => ({
    selectedNodeIds: s.selectedNodeIds,
  }));
  // ...
  return <NodeFrame title={data.label}>...</NodeFrame>;
});
```

### 11.3 文件命名

- React 组件：PascalCase (e.g., `FlowCanvas.tsx`)
- 工具函数：camelCase (e.g., `validateConnection.ts`)
- 类型定义：PascalCase 类型名 (e.g., `ScriptBeat = { ... }`)
- 目录：kebab-case

### 11.4 状态更新

```typescript
// ✅ 正确：使用 updateNodeData 更新节点
updateNodeData(nodeId, { path: newPath, status: { status: "running" } });

// ❌ 错误：直接修改 store
nodes.find(n => n.id === nodeId).data.path = newPath;
```

### 11.5 异步操作

Rust 异步命令使用 `?` 传播错误，返回 `Result<T, String>`：
```rust
async fn some_command() -> Result<String, String> {
    some_async_call().await?;
    Ok("success".to_string())
}
```

---

## 12. 质量门禁

```bash
# 快速检查
npm run quality:gate
# = tsc + lint + vitest + cargo test

# 完整检查
npm run quality:gate:full
# = quality:gate + playwright e2e
```

测试文件位置：
- 前端：`src/**/*.test.ts`
- 后端：`src-tauri/src/**/*.rs` 内嵌 `#[cfg(test)]`

---

## 13. 项目格式

工程目录结构（打开时自动创建）：
```
project-root/
├── canvasflow.json    # 画布数据（节点、边、视口）
├── assets/           # 素材目录
│   ├── images/
│   ├── videos/
│   └── audio/
└── .canvasflow/
    └── runs.db       # SQLite 运行日志
```

---

## 14. 开发提示

1. **修改节点数据**：始终通过 `updateNodeData(nodeId, patch)` 而不是直接修改
2. **新增 Tauri 命令**：在 `src-tauri/src/commands/` 写实现，在 `lib.rs` 注册
3. **状态监听**：用 `useEffect` 监听 store 变化时，注意清理函数避免内存泄漏
4. **ReactFlow 集成**：`onNodesChange`/`onEdgesChange`/`onConnect` 传入 projectStore 的对应方法
5. **视频生成调试**：Rust 层加了 `eprintln!` 日志到终端，看 `[poll_video_job_http]` 和 `[submit_video_job_http]` 标签
6. **Base64 限制**：图片 ≤30MB，视频 ≤50MB，音频 ≤15MB（Rust 层强制校验）
7. **工作流检测**：`useVideoIncomingReferenceItems` 追踪连线，自动检测 workflow 状态
