# 迭代 07：视频异步任务引擎（提交→轮询→下载落盘→入库→可观测）

> 日期：2026-04-28  
> 目标：把“视频生成 API 的异步任务模式”做成可复用的工程能力，支撑后续 R5/R6（视频生成/时间线导出）与 R7（容错与可观测）。

---

## 1. 背景与动机

外部对标（LibTV）与行业现实是：**视频生成几乎都是异步任务**：

- 提交生成请求 → 返回 `task_id`
- 轮询查询接口 → `queued / processing / succeeded / failed`
- 成功后得到 `video_url`（**通常短期有效**）→ 必须下载并落盘
- 落盘后写入工程资产库，回写节点 `path/assetId/meta`
- 全程需要可观测：进度、重试、错误原因、取消

本仓库已有基础：

- `generic_async_api_submit` / `generic_async_api_poll`（见 `docs/generic-async-api-adapter.md`）
- 资产写入与登记：`generate_image_asset` / `generate_tts_asset` 已实现“保存到 `assets/` + upsert_asset”
- run_events：DAG 执行器已落库事件，前端可拉取并派生节点运行状态

本迭代补齐：**视频任务的下载落盘 + 可复用调度 + 可观测**。

---

## 2. 本迭代目标（MVP）

### 2.1 能力目标

- 支持任意“提交→轮询”视频 API（OpenAI 兼容或第三方），通过 JSON Pointer 配置解析 `task_id/status/result_url/error`。
- 生成成功后：自动下载到工程 `assets/`，并 `upsert_asset`（kind=video）。
- 将结果回写到 `videoNode`：
  - `data.path = assets/xxx.mp4`
  - `data.assetId`（若 upsert 返回）
  - `data.video` 内记录简要任务信息（可选，MVP 可先仅落 run_events）
- run_events 可观测：提交、轮询、状态变化、下载、入库、失败原因（可在“运行日志”里看到）。

### 2.2 非目标（本轮不做）

- 真并行调度与队列（先跑通单任务/少量任务）。
- 完整“可取消”跨进程任务（MVP 可先做前端停止轮询 + 标记取消）。
- 完整成本/用量统计（属于 R7）。
- 对所有厂商签名（如需要复杂签名，先不纳入 generic adapter）。

---

## 3. 方案总览（推荐落点）

建议走**两段式**，先快后稳：

### 阶段 A（最快可落地）：前端 Agent 调度 + Rust 下载落盘

- 前端：新增 `videoTaskAgentRuntime`（类似现有 `runNodeTaskAgent` 模式）
  - sense：读取节点 prompt / 绑定镜头（可选）/ 选择 video model 配置
  - execute：调用 `generic_async_api_submit` → 轮询 `generic_async_api_poll` → 成功后调用 `download_remote_asset_to_project`
  - commit：回写 `videoNode.data.path/assetId`，并写 agent 事件（通过 `node-agent-event` 及 `append_agent_event`）
- Rust：新增下载落盘命令，复用 `db::upsert_asset` 与 `media::meta_json_for_av`

### 阶段 B（更一致）：Rust 执行器内置 `run_video_node` 算子

当阶段 A 跑通并稳定后，再把流程下沉到 `src-tauri/src/executor.rs`：

- `videoNode` 在 DAG 内成为一等算子：可被 `run_graph_with_patch` 统一调度、统一记录 run_events、统一失败策略（失败跳过/中止）。
- 好处：不需要前端常驻轮询；run_events 里可记录更完整的状态与耗时；未来做并行/续跑也更顺滑。

> 本迭代建议先完成阶段 A 的最小闭环；阶段 B 作为后续增强（或在 A 的基础上平滑迁移）。

---

## 4. 数据与配置设计（MVP）

### 4.1 视频异步 API 配置（建议放在 `videoNode.data.params.videoAsync`）

由于不同厂商接口差异很大，MVP 不强行固化某一家，直接复用 generic adapter 的配置项：

- `submit`：URL / method / headers / bodyTemplate / taskIdPointer
- `poll`：URL / method / headers / bodyTemplate / statusPointer / doneValue / resultUrlPointer / errorPointer
- `pollIntervalMs`：默认 3000
- `timeoutMs`：默认 120000（或按任务更长）
- `maxPoll`：最多轮询次数（避免无限跑）

建议结构（TypeScript 伪码）：

```ts
type GenericAsyncSubmit = {
  url: string;
  method?: "POST" | "GET";
  headers: Record<string, string>;
  body: Record<string, unknown>;
  taskIdPointer: string;
};

type GenericAsyncPoll = {
  url: string;
  method?: "POST" | "GET";
  headers: Record<string, string>;
  body: Record<string, unknown>;
  statusPointer: string;
  doneValue?: string;
  resultUrlPointer?: string;
  errorPointer?: string;
};

type VideoAsyncConfig = {
  submit: GenericAsyncSubmit;
  poll: GenericAsyncPoll;
  pollIntervalMs?: number;
  timeoutMs?: number;
  maxPoll?: number;
};
```

> 后续可把它上移到 `settings.json` 的 `video_models`，并在设置页提供可视化表单；MVP 先在节点 params 里存 JSON，便于快速验证。

### 4.2 结果写回（`videoNode.data`）

最小写回：

- `data.path`: `assets/<downloaded>.mp4`
- `data.assetId`: `db::upsert_asset` 返回的 id（已有资产表）

可选写回（便于 UI 展示）：

- `data.video.lastTask`: `{ providerId, taskId, status, startedAtMs, endedAtMs, resultUrl?: string }`

---

## 5. Rust 侧改动（阶段 A 必做）

### 5.1 新增命令：下载远程 URL → 保存到工程 assets/ → upsert_asset

建议新增 tauri command（放 `src-tauri/src/lib.rs`）：

- `download_remote_asset_to_project(projectPath, url, kind, sourceLabel?) -> { relPath, assetId? }`
  - kind：`"video" | "image" | "audio"`（先只用 video 也可）
  - 对 URL 做 basic 校验（空、过长、非法 scheme）
  - `reqwest::Client::get(url)` 拉 bytes
  - 生成文件名：`video_YYYYmmdd_HHMMSS_<uuid8>.mp4`（若服务返回 content-type 可推断扩展名；MVP 可先固定 mp4）
  - 写入 `assets/`
  - `db::upsert_asset(rel, "video", Some(sourceLabel), meta_json_for_av(...))`

实现可参考 `generate_image_asset` / `generate_tts_asset` 的落盘与 upsert 模式。

### 5.2 可观测：事件落库（MVP 方案）

阶段 A 的日志可以先走已有的 `append_agent_event`（前端已在 `App.tsx` 里监听 `node-agent-event` 并写入 runs.db）。

建议在前端对每个关键步骤 emit：

- `video_submit_ok`：拿到 taskId
- `video_poll`：每 N 次 / 每次状态变化记录一次（避免刷爆 DB）
- `video_download_start` / `video_download_ok`
- `video_asset_upsert_ok`
- `video_done` 或 `video_failed`

> 之后进入阶段 B 时，改由 `executor.rs` 的 `db::log_event` 记录更结构化事件。

---

## 6. 前端改动（阶段 A 必做）

### 6.1 新增 runtime：`videoTaskAgentRuntime`

位置建议：`src/lib/nodeAgentRuntime/videoTaskAgent.ts` + `dagnodeDispatchAgents.ts` 中导出。

输入（最小）：

- `nodeId`
- `projectPath`
- `videoAsyncConfig`（从 node.params 或 settings 读取）
- `prompt`（从 `video.draft.prompt` 或与脚本绑定拼接后的 prompt）

执行流程（伪码）：

1. `invoke("generic_async_api_submit", { req: submitReq })` → `taskId`
2. loop:
   - `invoke("generic_async_api_poll", { req: pollReqWithTaskId })`
   - emit 事件（状态变化/节流）
   - done 且 `resultUrl` 非空 → break
   - sleep(pollIntervalMs)
3. `invoke("download_remote_asset_to_project", { projectPath, url: resultUrl, kind: "video", sourceLabel: "video-gen" })`
4. `updateNodeData(videoNodeId, { path: relPath, assetId })`

### 6.2 触发入口

MVP 先给 videoNode 展开面板一个“生成/运行”按钮，或复用现有“运行子图”入口：

- 推荐：在 videoNode 展开区新增按钮，不依赖整图运行（更符合用户直觉）。
- 之后再与 DAG 运行统一（阶段 B）。

---

## 7. 验收（必须写成 5 步以内）

### 手工验收（桌面端）

1. 打开工程，新增一个 `videoNode`，在其提示词处输入一段文案。  
2. 在 `videoNode.params.videoAsync` 写入一份可用的 submit/poll 配置（对接你有权限的异步视频 API）。  
3. 点击“生成/运行”，观察状态栏与日志：出现提交成功、轮询中、下载中。  
4. 成功后：`videoNode.data.path` 写入 `assets/...mp4`，预览可播放；工程 `assets/` 下确实存在该文件。  
5. 重启 App 打开同工程：视频仍可预览；素材库/索引（如有）可找到该文件。

### 失败验收

- 用错误的 `taskIdPointer` / `statusPointer`：应给出明确报错（“未在响应中找到 task_id …” / “statusPointer 不能为空”），并结束任务。
- 用过期的 `video_url`：应提示下载失败并保留 taskId / 原始响应（便于排查）。

---

## 8. 回退策略

- Rust 新增命令为旁路，不影响现有 DAG 执行；若出现问题可先禁用 videoNode 的“生成按钮”入口，保留代码。
- 节点数据写回遵循“仅在下载成功后写 path/assetId”，失败不污染工程。

---

## 9. 当前代码落点（已实现）

截至 2026-04-28，阶段 A 的最小闭环已落地到代码：

### 9.1 Rust（下载落盘 + 入库）

- 新增 tauri command：`download_remote_asset_to_project`  
  - 文件：`src-tauri/src/lib.rs`  
  - 行为：HTTP 下载 → 保存到工程 `assets/` → `db::upsert_asset` → 返回 `{ relPath, assetId }`  
  - 依赖：新增 `url = "2"`（`src-tauri/Cargo.toml`）

### 9.2 前端（自动走 videoAsync 分支）

- 若 `videoNode.data.params.videoAsync` 存在且为对象，视频节点“生成”入口将改走通用异步任务流程：  
  - 提交：`invoke("generic_async_api_submit")`  
  - 轮询：`invoke("generic_async_api_poll")`（支持 `{{taskId}}` 变量注入到 poll body）  
  - 落盘：`invoke("download_remote_asset_to_project")`  
  - 回写：`updateNodeData(videoNodeId, { path, assetId })`

相关文件：

- `src/lib/nodeAgentRuntime/videoAsyncTaskAgent.ts`（`videoAsyncTaskAgentRuntime`）
- `src/hooks/useVideoNodeGeneration.ts`（在 `startGeneration` 中检测 `params.videoAsync` 并切换 runtime）

### 9.3 示例配置（占位模板）

> 下面是一个“形状模板”，你只要把 `url/header/body/json pointer` 按供应商文档改掉即可。

```json
{
  "submit": {
    "url": "https://api.example.com/video/submit",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer <token>",
      "Content-Type": "application/json"
    },
    "body": {
      "prompt": "一只奔跑的猫"
    },
    "taskIdPointer": "/data/task_id"
  },
  "poll": {
    "url": "https://api.example.com/video/result",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer <token>",
      "Content-Type": "application/json"
    },
    "body": {
      "task_id": "{{taskId}}"
    },
    "statusPointer": "/data/status",
    "doneValue": "succeeded",
    "resultUrlPointer": "/data/video_url",
    "errorPointer": "/data/error"
  },
  "pollIntervalMs": 3000,
  "timeoutMs": 600000,
  "maxPoll": 240,
  "kind": "video",
  "sourceLabel": "video-async"
}
```

---

## 10. Mock 视频生成（无需任何厂商 API 的验收方式）

本仓库已内置 mock 命令（通过前端 `videoGeneration/bridge.ts` 直连 tauri invoke）：

- `video_gen_start`
- `video_gen_get_job`
- `video_gen_cancel`

### 10.1 行为

- 点击视频节点里的“↑ 生成”会触发 `video_gen_start`
- `useVideoNodeGeneration` 轮询 `video_gen_get_job`
  - 前 3 次：返回 `queued/running` + `progress`
  - 第 4 次起：返回 `succeeded`，并生成一个 **2 秒纯黑 mp4** 落到工程 `assets/`，同时 `upsert_asset`
- 前端收到 `resultRelPath` 后会自动写回 `videoNode.data.path`

### 10.2 前置条件

- 需要系统可执行的 `ffmpeg`（或在设置 `settings.json` 里配置 `ffmpeg_path`）。  
  > 本项目已支持将 ffmpeg 作为 Tauri sidecar 打包（零依赖）。若打包时提供 `src-tauri/bin/ffmpeg(.exe)`，运行时会自动优先使用内置 ffmpeg。

### 10.3 手工验收（5 步）

1. 桌面端启动并打开工程目录。  
2. 新建一个 **视频节点**，展开后在底部面板输入任意提示词。  
3. 点击右侧“↑”提交生成。  
4. 等待 3~8 秒：视频节点应自动出现可播放预览，且 `assets/` 下新增 `mock_video_*.mp4`。  
5. 关闭并重开工程：视频仍可预览（`path` 已写入工程 JSON）。

### 10.4 常见问题

- 若提示 “无法启动 ffmpeg / 退出码 …”：说明本机未安装 ffmpeg 或路径不可用。  
  解决：安装 ffmpeg 并确保 `ffmpeg` 在 PATH 中，或在设置中填写 `ffmpeg_path`。

