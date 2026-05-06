# Hermes Pipeline Agent v4.0 方案审查报告

> 审查日期：2026-04-30
> 对照代码库实际状态，逐 Step 审查方案可行性

---

## 审查总览

| 类别 | 数量 |
|------|------|
| 🔴 编译/运行时错误 | 5 |
| 🟡 逻辑缺陷 / 行为不一致 | 6 |
| 🔵 遗漏 / 缺失步骤 | 4 |
| ⚪ 建议优化 | 5 |

---

## 🔴 编译/运行时错误

### E1. Step 3a：`build_llm_request_parts` 与现有 `openai_chat_completion` 逻辑分叉

**现状**：`llm.rs` 的 `openai_chat_completion`（第 12-88 行）内联了完整的 provider 解析 + body 构建 + HTTP 调用逻辑。

**问题**：方案新增 `build_llm_request_parts` 提取公共逻辑，但**没有说明是否重构 `openai_chat_completion` 来调用它**。如果不重构，则同一逻辑存在两份代码；如果重构，则 `extra_params` 过滤行为有变化：

- 原始：`if k != "model" && k != "messages" && k != "providerId"`
- 新增：`if k != "model" && k != "messages" && k != "providerId" && k != "tools" && k != "stream"`

新增的 `"tools"` 和 `"stream"` 过滤不会影响现有功能（`openai_chat_completion` 不处理 tool_calls 和 stream），但如果重构后原函数走 `build_llm_request_parts`，任何通过 `extra_params` 传入 `tools` 或 `stream` 的现有调用者会被静默忽略。

**修复建议**：

方案应明确二选一：
- **（推荐）重构 `openai_chat_completion` 调用 `build_llm_request_parts`**，并在方案中写出重构后的代码。当前 `llm.rs:run_llm_node` 传 `&params` 作为 `extra_params`，params 不含 `tools`/`stream`，安全。
- 或者不重构，在方案中注明 `build_llm_request_parts` 仅供新函数使用，`openai_chat_completion` 保持原样。

---

### E2. Step 9c：ScriptNode 引用不存在的变量 `themePrompt`

**方案代码**：
```tsx
<NodeAgentStrip
  nodeId={nodeId}
  nodeType="scriptNode"
  getPrompt={() => themePrompt}
  setPrompt={(v) => updateNodeData(nodeId, { prompt: v })}
/>
```

**实际代码**：`ScriptNode.tsx` 中没有 `themePrompt` 变量，也没有 `nodeId` 变量。实际可用：
- 节点 ID：`id`（来自 `NodeProps` 解构）
- 主题提示词：`prompt`（来自 `data.prompt ?? ""`）

**修复**：
```tsx
<NodeAgentStrip
  nodeId={id}
  nodeType="scriptNode"
  getPrompt={() => prompt}
  setPrompt={(v) => updateNodeData(id, { prompt: v })}
/>
```

---

### E3. Step 9d：AudioTtsPanel 引用不存在的变量 `text`

**方案代码**：
```tsx
<NodeAgentStrip
  nodeId={nodeId}
  nodeType="audioNode"
  getPrompt={() => text}
  setPrompt={(v) => updateNodeData(nodeId, { prompt: v })}
/>
```

**实际代码**：`AudioTtsPanel.tsx` 的 props 只有 `{ nodeId: string }`，没有 `text` prop。TTS 文本通过 `prompt` 变量访问（从 `node.data.prompt` 派生），且有 `MAX_CHARS` 截断限制。

**修复**：
```tsx
<NodeAgentStrip
  nodeId={nodeId}
  nodeType="audioNode"
  getPrompt={() => prompt}
  setPrompt={(v) => updateNodeData(nodeId, { prompt: v.slice(0, MAX_CHARS) })}
/>
```

需要在集成时确认 `prompt` 和 `MAX_CHARS` 在组件上下文中可见。`AudioTtsPanel` 内部已有这些变量，直接使用即可。

---

### E4. Step 3d：`reqwest` 缺少 `"stream"` feature

**当前 Cargo.toml**（第 22 行）：
```toml
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
```

**缺少 `"stream"` feature**。方案在 Step 3d 提到了需要添加，但只是以注释形式写在验证步骤里，不够醒目。如果遗漏此改动，`bytes_stream()` 方法将不存在，编译报错。

**修复**：将 Cargo.toml 修改为方案明确的一行，提升为 Step 3d 的正文动作（不是注释）：
```toml
reqwest = { version = "0.12", features = ["json", "stream", "rustls-tls"], default-features = false }
```

---

### E5. Step 2：`use super::types::AssetCard;` 放在函数代码块内

方案在 `graph_flow.rs` 末尾追加的代码中，`use super::types::AssetCard;` 放在了 `// ─── Asset Card 提取 ────` 注释之后、函数定义之前。

这在 Rust 中虽然合法，但不符合惯例（`use` 通常放在文件顶部）。更重要的是，如果后续有人维护时没有注意到这个中间位置的 `use`，可能导致混淆。

**修复**：将 `use super::types::AssetCard;` 移到文件顶部 import 区域，与现有 `use crate::graph::{CanvasGraph, FlowNode};` 并列。

---

## 🟡 逻辑缺陷 / 行为不一致

### L1. 「直连上游」vs「全量上游」描述与代码矛盾

**架构文档**（第 97 行）写：
> v1 实现：**自动注入所有直连上游**的资产卡

**实际代码**：`enhance_prompt` 和 `chat_stream` 都调用 `all_upstream_asset_cards()`，即**递归全量上游**。

**影响**：对于 `textNode → scriptNode → imageNode` 这种链式 DAG：
- 「直连上游」：imageNode 只看到 scriptNode 的资产卡
- 「全量上游」：imageNode 看到 textNode + scriptNode 的资产卡

全量上游实际上更合理（越下游越懂你的故事），但文档描述不一致会让 Cursor 执行时困惑。

**修复**：将文档改为「v1 自动注入所有上游（含间接）的资产卡」，与代码一致。

---

### L2. Step 7：`sendChatStream` 事件监听生命周期竞态

**问题链**：
1. `sendChatStream` 注册 `:token` 和 `:done` 事件监听
2. 调用 `invoke("hermes_chat_stream", ...)` —— 这是异步的，等待后端返回
3. 在 `finally` 块中 `unlistenToken()` 和 `unlistenDone()`

**竞态条件**：后端在流结束时先 emit `:done` 事件，然后 `invoke` 才返回。但 Tauri 的事件分发是异步的，`invoke` 返回时 `:done` 事件可能还没被前端处理。此时 `finally` 已执行，监听器被移除，导致：
- `chatHistories` 中缺少 assistant 的最终回复
- `agentState` 未被重置为 `idle`

**修复建议**：不在 `finally` 中清理监听器，而是在 `:done` 事件回调中清理：

```typescript
const unlistenDone = await listen<{ fullContent: string }>(`${eventPrefix}:done`, (event) => {
  // ... 更新 chatHistories 和 agentState ...
  unlistenToken();   // 在 :done 回调中清理
  unlistenDone();    // 自清理（闭包持有引用）
});
```

同时，`invoke` 返回的 `fullContent` 不应作为函数返回值依赖，因为存在竞态。改用 Promise + resolve 模式：

```typescript
return new Promise<string>((resolve) => {
  const unlistenDone = await listen(`${eventPrefix}:done`, (event) => {
    // ...
    resolve(event.payload.fullContent);
    unlistenToken();
    unlistenDone();
  });
  // invoke 不需要 await 结果，只需确保后端收到请求
  invoke("hermes_chat_stream", { ... }).catch(/* ... */);
});
```

---

### L3. Step 7：Chat 失败时用户消息残留在历史中

**问题**：`sendChatStream` 在调用 `invoke` 之前就把用户消息写入了 `chatHistories`（第 1096-1100 行）。如果 `invoke` 失败（网络错误、API Key 缺失等），用户消息已写入但无 assistant 回复，下次打开对话会看到一条孤立的用户消息。

**修复建议**：在 `catch` 块中移除最后添加的用户消息：

```typescript
} catch (e) {
  // 回滚用户消息
  set((s) => ({
    chatHistories: {
      ...s.chatHistories,
      [nodeId]: (s.chatHistories[nodeId] ?? []).slice(0, -1),
    },
  }));
  get().setAgentState(nodeId, "idle");
  get().clearStreamBuffer(nodeId);
  throw e;
}
```

---

### L4. Step 6：`hermes_enhance` / `hermes_chat_stream` 不暴露 `extra_params`

两个 Tauri Command 都硬编码 `&serde_json::json!({})` 作为 `extra_params`，导致：
- 用户无法选择特定 Provider（`providerId`）
- 用户无法覆盖模型（`model`）
- 无法传入 temperature 等参数

**影响**：当前所有节点共享同一个默认 Provider，无法针对不同节点类型使用不同模型。例如，脚本拆分可能需要强推理模型，而图片提示词优化用快速模型即可。

**修复建议**：在两个命令中增加可选参数：

```rust
#[tauri::command]
pub async fn hermes_enhance(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    graph_json: serde_json::Value,
    node_id: String,
    current_prompt: String,
    extra_params: Option<serde_json::Value>,  // 新增
) -> Result<String, String> {
    let extra = extra_params.unwrap_or(json!({}));
    // ...
    hermes_agent::enhance_prompt(&state.http, &s, &graph, &node_id, &current_prompt, &extra).await
}
```

前端也需相应更新 `invoke` 调用。

---

### L5. Step 3c：SSE 流式解析的 UTF-8 截断风险

**代码**（第 586 行）：
```rust
buffer.push_str(&String::from_utf8_lossy(&chunk));
```

`from_utf8_lossy` 在遇到不完整的多字节 UTF-8 序列时会替换为 `\u{FFFD}`。如果 CJK 字符被 TCP 分包切到两个 chunk 之间，会产出乱码。

**影响**：中文 LLM 输出中 CJK 字符很常见。虽然单个 token 通常是完整 UTF-8，但 TCP 分包不保证这一点。

**修复建议**：使用 `bytes` 级别的 buffer，只在 `\n\n` 边界处尝试 UTF-8 解码：

```rust
let mut byte_buffer: Vec<u8> = Vec::new();
while let Some(chunk) = stream.next().await {
    let chunk = chunk.map_err(|e| e.to_string())?;
    byte_buffer.extend_from_slice(&chunk);
    while let Some(pos) = byte_buffer.windows(2).position(|w| w == b"\n\n") {
        let line_bytes = byte_buffer[..pos].to_vec();
        byte_buffer = byte_buffer[pos + 2..].to_vec();
        let line = String::from_utf8_lossy(&line_bytes);
        // ... 解析 SSE data: 行 ...
    }
}
```

---

### L6. Step 5：`chat()` 函数是死代码

`hermes_agent.rs` 定义了 `chat()` 函数（非流式多轮对话），但没有任何 Tauri Command 调用它。`hermes_chat_stream` 只调用 `chat_stream()`。

**修复建议**：二选一：
- 删除 `chat()` 函数，v1 只支持流式
- 或保留但在方案中注明「预留给未来非流式场景」

---

## 🔵 遗漏 / 缺失步骤

### M1. 缺少 videoNode 集成步骤（Step 9e）

方案定义了 `VIDEO_CINEMATOGRAPHER_PROMPT` 角色和 `extract_video_card` 提取逻辑，但 **Step 9 没有集成 videoNode**。

`VideoAssetNode.tsx` 使用 `TextNodeTextToVideoPanel` 子组件处理文生视频流程。视频节点的提示词来自 `data.video.draft.prompt`（通过 `useTtvDraft` hook），而非简单的 `data.prompt`。

**需要新增 Step 9e**：

```tsx
// VideoAssetNode.tsx 中，在 NodeFrame 的 floatingBottomOverlay 区域
// 或在 TextNodeTextToVideoPanel 内部追加 NodeAgentStrip

// 由于 videoNode 的 prompt 存储在 data.video.draft.prompt 中，
// 需要通过 useTtvDraft hook 获取
<NodeAgentStrip
  nodeId={id}
  nodeType="videoNode"
  getPrompt={() => draftPrompt}  // 来自 useTtvDraft
  setPrompt={(v) => updateDraft({ prompt: v.slice(0, VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS) })}
/>
```

需要先确认 `useTtvDraft` 的 API，再精确定义集成方式。

---

### M2. 缺少 LLMNode 集成步骤

方案在 `extract_asset_card` 和 `node_type_system_prompt` 中都处理了 `"llm"` 节点类型，但 Step 9 没有 `LLMNode` 的集成。

`LLMNode.tsx` 是一个极简组件（24 行），只显示 prompt 预览，没有可编辑区域。集成 NodeAgentStrip 的价值有限（用户无法直接编辑 prompt），但可以提供对话功能。

**建议**：v1 不集成 LLMNode（与 TextNode 功能重叠），在方案中注明。

---

### M3. 缺少 Hermes 与现有 nodeAgentRuntime 的关系说明

现有代码已有完整的 `nodeAgentRuntime` 系统：
- `imageGenerationAgentRuntime`：调用图片生成 API → 写回 `data.path`
- `audioTtsAgentRuntime`：调用 TTS API → 写回 `data.path`
- `videoGenerationAgentRuntime`：提交视频生成任务
- `scriptStoryboardGenerateAgentRuntime`：生成脚本分镜
- `runNodeTaskAgent`：sense → execute → validate → commit 4 阶段管线

**Hermes 与 nodeAgentRuntime 的关系**：
| | nodeAgentRuntime | Hermes Agent |
|---|---|---|
| 定位 | 确定性任务执行 | 创意增强 + 对话 |
| 行为 | 生成资产（图片/音频/视频） | 优化提示词、提供创作建议 |
| 模式 | 单次执行 | Enhance 单次 + Chat 多轮 |
| 写回 | 自动写入 `node.data` | 用户确认后才写回 |

方案应增加一个段落说明两者关系，避免 Cursor 执行时混淆。

---

### M4. 缺少 `clearChatHistory` action

`hermesStore.ts` 提供了 `chatHistories` 的读写，但没有清除单个节点聊天历史的 action。用户无法重新开始对话。

**修复**：在 `HermesState` 中添加：

```typescript
clearChatHistory: (nodeId: string) => void;
```

实现：
```typescript
clearChatHistory: (nodeId) => {
  set((s) => {
    const next = { ...s.chatHistories };
    delete next[nodeId];
    return { chatHistories: next };
  });
},
```

在 `NodeAgentStrip` 的对话面板头部添加清除按钮。

---

## ⚪ 建议优化

### S1. Step 2：`all_upstream_asset_cards` 的 BFS 可以复用 `graph.rs` 的 `downstream_descendants` 模式

当前 `all_upstream_asset_cards` 重新实现了 BFS 遍历。`graph.rs` 已有 `downstream_descendants`（前向 BFS），可以考虑提取公共的图遍历工具函数，减少重复代码。

**优先级**：低，v1 可不做。

---

### S2. Step 8：`NodeAgentStrip` 的 `getGraphJson()` 每次调用都重新获取整个画布

`getGraphJson()` 在 enhance 和 chat 时各调用一次 `useProjectStore.getState()`，序列化整个画布（所有节点 + 边）。对于大型画布，这可能造成延迟。

**优化方向**：
- v1：保持现状，可接受
- v2：只传当前节点的上游子图（需要后端支持子图解析）

---

### S3. Step 5：System Prompt 与项目实际语言/风格绑定

当前 system prompt 硬编码中文输出。如果用户的 LLM Provider 使用非中文模型，或项目需要英文输出，固定中文可能不合适。

**优化方向**：v1 保持中文硬编码，v2 可从 settings 读取语言偏好。

---

### S4. Step 3c：SSE 解析不支持 `tool_calls` 流式增量

`openai_chat_completion_stream` 只处理 `delta/content`，不支持 `delta/tool_calls` 的流式增量。v1 Hermes 不使用 tool_calls，无影响，但应在方案注释中明确。

---

### S5. Step 10：CSS 中使用 `var(--color-*)` 变量需确认存在

方案中的 CSS 使用了 `--color-border-tertiary`、`--color-text-secondary`、`--color-background-info` 等变量。需确认这些变量在 `global.css` 的 `:root` 中已定义。

经检查，`global.css` 中存在 `--color-border-tertiary`、`--color-text-secondary`、`--color-background-secondary` 等变量。但 `--color-background-info` 可能不存在，需用 `--color-background-info, #EEEDFE` 的 fallback 方式（方案已做了，✅）。

---

## 修复优先级排序

| 优先级 | 编号 | 描述 | 工作量 |
|--------|------|------|--------|
| P0 | E2 | ScriptNode `themePrompt` → `prompt` | 1 分钟 |
| P0 | E3 | AudioTtsPanel `text` → `prompt` | 1 分钟 |
| P0 | E4 | reqwest 添加 `stream` feature | 1 分钟 |
| P1 | L2 | sendChatStream 事件监听竞态 | 15 分钟 |
| P1 | L4 | 暴露 extra_params | 10 分钟 |
| P1 | E1 | build_llm_request_parts 与 openai_chat_completion 关系 | 15 分钟 |
| P1 | M1 | videoNode 集成步骤 | 30 分钟 |
| P1 | L1 | 文档「直连上游」→「全量上游」 | 1 分钟 |
| P2 | L3 | Chat 失败回滚用户消息 | 5 分钟 |
| P2 | M4 | clearChatHistory action | 5 分钟 |
| P2 | L5 | SSE UTF-8 截断修复 | 10 分钟 |
| P2 | L6 | 删除/注明死代码 chat() | 1 分钟 |
| P2 | E5 | use 语句移到文件顶部 | 1 分钟 |
| P3 | M2 | LLMNode 集成说明 | 5 分钟 |
| P3 | M3 | Hermes 与 nodeAgentRuntime 关系文档 | 10 分钟 |
| P3 | S1-S5 | 各项优化 | 按需 |

---

## 审查结论

方案核心架构（DAG-native + 资产卡 + 无状态 Agent）**设计合理**，与实际代码库兼容。主要问题集中在：

1. **前端变量名错误**（E2、E3）：Cursor 直接执行会编译报错
2. **事件监听竞态**（L2）：流式对话可能丢消息
3. **遗漏 videoNode 集成**（M1）：后端定义了角色但前端没接入
4. **缺少 extra_params 暴露**（L4）：用户无法选 Provider/模型

建议在 Cursor 执行前，先修复 P0 和 P1 的问题，P2 可在实现过程中顺带处理。
