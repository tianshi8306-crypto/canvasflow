# Hermes Pipeline Agent 引入方案 — Cursor 执行手册

> 每一步都是精确的文件路径 + 代码 + 验证命令。按步骤顺序执行，不要跳步。
>
> 版本：v4.0 · 2026-04-30（架构重构：DAG-native + 资产卡 + @引用 + 无状态 Agent）
>
> **核心理念**：画布状态即上下文 · 资产引用即约束 · 每次调用无状态。
> Hermes Agent 不需要自己的「记忆」——画布 DAG 就是记忆，节点产出就是资产，
> @引用就是精准注入。越到下游，上游资产卡越多，Agent 越懂你的故事。

---

## v3.1 → v4.0 架构变更对照

| 维度 | v3.1（旧） | v4.0（新） | 理由 |
|------|-----------|-----------|------|
| 上下文来源 | Pipeline Session + `accumulated_context` 字符串 | 运行时遍历画布 DAG，从节点 `data` 提取资产卡 | 画布已是 SSOT，无需冗余持久化 |
| 上下文格式 | 字符串摘要 → LLM 压缩 → 暴力截断 | 结构化 `AssetCard[]`，按节点类型提取关键字段 | 无损、可引用、无增长风险 |
| 状态管理 | 有状态 Session（DB 持久化 `pipeline_sessions` + `pipeline_node_visits`） | 无状态（每次调用实时计算上下文） | 消除 Session 一致性问题 |
| Tauri Commands | 9 个（Session 管理 5 + 访问记录 1 + AI 3） | 2 个（`hermes_enhance` + `hermes_chat`） | 大幅减少接口表面积 |
| 新增 DB 表 | 2 个（`pipeline_sessions`, `pipeline_node_visits`） | 0 个 | 无需持久化 Agent 状态 |
| 上下文注入 | 隐式全量灌入 system prompt | v1 自动注入所有上游资产卡（含间接）；v2 `@引用` 显式声明 | 用户可控、token 精准 |
| 上下文压缩 | LLM 压缩 + 暴力截断（有损） | 资产卡天然精炼 + token budget 智能裁剪 | 无损优先，token 够就不裁剪 |

---

## 架构总览

```
用户输入模糊想法
       ↓
  ┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ textNode │ ──→ │scriptNode│ ──→ │imageNode │ ──→ │videoNode │ ──→ │audioNode │
  │ Story    │     │ Script   │     │ Image    │     │ Video    │     │ Audio    │
  │ Architect│     │ Doctor   │     │ Director │     │Cinematogr│     │ Designer │
  └──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
       │                │                │                │                │
       └────────────────┴────────────────┴────────────────┴────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │   画布 DAG = 上下文源        │
                    │   节点 data = 资产卡         │
                    │   @引用 = 显式约束注入       │
                    │   每次调用无状态             │
                    └─────────────────────────────┘
```

**每个节点底部面板的两种 AI 模式**：
1. **Enhance**（一键优化提示词）— 单次 LLM 调用，带上游资产卡上下文
2. **Chat**（智能对话）— 多轮对话，Agent 可直接修改节点参数，流式输出

> **设计决策**：v1 不实现 Smart Generate（优化 → 执行 → 校验 → 迭代闭环），
> 按钮保留但禁用，标注"即将推出"。`quality_score` 计算逻辑 v2 设计。

**与 v3.1 的关键区别**：
- v3.1：Agent 需要维护 Pipeline Session，通过 `accumulated_context` 字符串传递上下文
- v4.0：**画布本身就是上下文**，Agent 每次调用时实时遍历 DAG 提取上游资产卡，无状态

### Hermes Agent 与 nodeAgentRuntime 的关系

项目中已有一套 `nodeAgentRuntime` 系统（`src/lib/nodeAgentRuntime/`），它和 Hermes Agent **职责不同、互不冲突**：

| | nodeAgentRuntime | Hermes Agent |
|---|---|---|
| **定位** | 确定性任务执行 | 创意增强 + 对话 |
| **行为** | 生成资产（调用 API 生成图片/音频/视频，写回 `node.data.path`） | 优化提示词、提供创作建议 |
| **模式** | sense → execute → validate → commit 四阶段管线 | Enhance 单次 + Chat 多轮流式 |
| **写回** | 自动写入 `node.data` | 用户确认后才手动写回 |
| **上下文** | 不感知上游 | 遍历 DAG 获取上游资产卡 |

**简单理解**：nodeAgentRuntime 是「执行者」（帮你干活），Hermes 是「顾问」（帮你出主意）。两者可以在同一个节点上共存。

---

## 资产卡（Asset Card）设计

资产卡是节点产出的结构化摘要。每种节点类型有不同的提取逻辑，从节点的 `data` JSON 中提取关键字段。

```typescript
// 前端类型定义
type AssetCard = {
  nodeId: string;
  nodeType: string;
  label: string;           // 节点标题或用户可见名称
  summary: string;         // 200 字以内的人类可读摘要
  keywords: string[];      // 关键标签（角色名、场景、风格等）
  references: string[];    // 可 @引用的资产路径（图片/视频/音频）
};
```

### 各节点类型的资产卡提取规则

| 节点类型 | label 来源 | summary 提取 | keywords 提取 | references 提取 |
|----------|-----------|-------------|--------------|----------------|
| textNode / llm | `data.prompt` 前 30 字 | `data.prompt` 全文（截断 500 字） | 实体提取暂不实现，v2 | — |
| scriptNode | `data.prompt` 前 30 字 | `data.scriptBeats` 每个镜头的 `description` 拼接 | 角色：从 beats 提取 `character` 字段 | — |
| imageNode | `data.params.prompt` 前 30 字 | `data.params.prompt` 全文 | 风格关键词 | `data.path`（图片路径） |
| videoNode | `data.params.prompt` 前 30 字 | `data.params.prompt` 全文 | 镜头运动关键词 | `data.path`（视频路径） |
| audioNode | `data.params.text` 前 30 字 | `data.params.text` 全文 | 情感标签 | `data.path`（音频路径） |

### 后端提取实现

资产卡在后端通过遍历画布 DAG 从 `FlowNode.data` 中提取，**不依赖额外 DB 表**。

---

## @引用机制

用户可以在对话中用 `@节点名` 或 `@镜头3` 显式引用上游资产。后端解析引用后，只将引用的资产卡注入上下文。

v1 实现：**自动注入所有上游（含间接）的资产卡**（等价于隐式全量引用，但数据源是资产卡而非字符串）。显式 @引用 UI 交互留到 v2。

> **v1 退而求其次的原因**：显式 @引用需要节点搜索 UI + 引用解析器，增加前端复杂度。
> v1 先用自动注入验证资产卡架构的可行性，v2 再加 @引用 UI。

---

## 前置条件

执行前确认以下条件全部满足，不满足则停止：

- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` 全部通过
- [ ] `npm run typecheck` 无错误
- [ ] `npm run test` 全部通过

> **注意**：v4.0 不再要求 `projectStore.ts` 先拆分。
> 前端集成只需在节点组件中引入 `NodeAgentStrip`，改动点小且隔离。
> 后端步骤（Step 1-6）与前端完全无关，可先行。

---

## Step 1：新增 LLM 响应类型 + 资产卡类型

**文件**：`src-tauri/src/executor/types.rs`

在文件末尾追加：

```rust
/// LLM 响应的完整解析结果（含 tool_calls）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmResponse {
    pub content: Option<String>,
    pub tool_calls: Vec<ToolCall>,
    pub finish_reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: serde_json::Value,
}

/// 资产卡——节点产出的结构化摘要，供下游 Agent 消费
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetCard {
    pub node_id: String,
    pub node_type: String,
    /// 节点标题或用户可见名称（如 prompt 前 30 字）
    pub label: String,
    /// 200 字以内的人类可读摘要
    pub summary: String,
    /// 关键标签（角色名、场景、风格等）
    #[serde(default)]
    pub keywords: Vec<String>,
    /// 可 @引用的资产路径（图片/视频/音频）
    #[serde(default)]
    pub references: Vec<String>,
}
```

**验证**：`cargo check --manifest-path src-tauri/Cargo.toml` 编译通过。

---

## Step 2：graph_flow.rs 新增资产卡提取函数

**文件**：`src-tauri/src/executor/graph_flow.rs`

在文件末尾追加：

```rust
// ─── Asset Card 提取 ──────────────────────────────────

/// 从画布 DAG 中提取指定节点的所有直连上游资产卡，按拓扑序排列。
pub(crate) fn upstream_asset_cards(
    graph: &CanvasGraph,
    node_id: &str,
) -> Vec<AssetCard> {
    let order = match crate::graph::topological_order(graph) {
        Ok(o) => o,
        Err(_) => return Vec::new(),
    };
    let mut topo_index: HashMap<String, usize> = HashMap::new();
    for (i, id) in order.iter().enumerate() {
        topo_index.insert(id.clone(), i);
    }

    // 收集所有直连上游节点 ID
    let mut upstream_ids: Vec<(usize, String)> = Vec::new();
    for e in &graph.edges {
        if e.target == node_id {
            let idx = topo_index.get(&e.source).copied().unwrap_or(0);
            upstream_ids.push((idx, e.source.clone()));
        }
    }
    upstream_ids.sort_by_key(|p| p.0);

    let mut cards = Vec::new();
    for (_, uid) in &upstream_ids {
        if let Some(node) = node_by_id(graph, uid) {
            cards.push(extract_asset_card(node));
        }
    }
    cards
}

/// 递归提取所有上游（含间接）资产卡——用于需要完整管线上下文的场景。
pub(crate) fn all_upstream_asset_cards(
    graph: &CanvasGraph,
    node_id: &str,
) -> Vec<AssetCard> {
    let order = match crate::graph::topological_order(graph) {
        Ok(o) => o,
        Err(_) => return Vec::new(),
    };
    let mut topo_index: HashMap<String, usize> = HashMap::new();
    for (i, id) in order.iter().enumerate() {
        topo_index.insert(id.clone(), i);
    }

    // BFS 收集所有上游节点
    let mut visited: HashSet<String> = HashSet::new();
    let mut queue: VecDeque<String> = VecDeque::new();
    for e in &graph.edges {
        if e.target == node_id {
            if visited.insert(e.source.clone()) {
                queue.push_back(e.source.clone());
            }
        }
    }
    while let Some(cur) = queue.pop_front() {
        for e in &graph.edges {
            if e.target == cur && visited.insert(e.source.clone()) {
                queue.push_back(e.source.clone());
            }
        }
    }

    // 按拓扑序排序
    let mut sorted: Vec<(usize, String)> = visited
        .into_iter()
        .filter_map(|id| topo_index.get(&id).map(|&idx| (idx, id)))
        .collect();
    sorted.sort_by_key(|p| p.0);

    sorted
        .into_iter()
        .filter_map(|(_, uid)| node_by_id(graph, &uid).map(extract_asset_card))
        .collect()
}

/// 根据节点类型从 `FlowNode.data` 提取资产卡
fn extract_asset_card(node: &FlowNode) -> AssetCard {
    match node.node_type.as_str() {
        "textNode" | "llm" => extract_text_card(node),
        "scriptNode" => extract_script_card(node),
        "imageNode" | "imageAsset" => extract_image_card(node),
        "videoNode" => extract_video_card(node),
        "audioNode" => extract_audio_card(node),
        _ => AssetCard {
            node_id: node.id.clone(),
            node_type: node.node_type.clone(),
            label: truncate(node.data.get("prompt").and_then(|v| v.as_str()).unwrap_or(""), 30),
            summary: truncate(node.data.get("prompt").and_then(|v| v.as_str()).unwrap_or(""), 500),
            keywords: Vec::new(),
            references: Vec::new(),
        },
    }
}

fn extract_text_card(node: &FlowNode) -> AssetCard {
    let prompt = node.data.get("prompt").and_then(|v| v.as_str()).unwrap_or("");
    AssetCard {
        node_id: node.id.clone(),
        node_type: node.node_type.clone(),
        label: truncate(prompt, 30),
        summary: truncate(prompt, 500),
        keywords: Vec::new(),
        references: Vec::new(),
    }
}

fn extract_script_card(node: &FlowNode) -> AssetCard {
    let prompt = node.data.get("prompt").and_then(|v| v.as_str()).unwrap_or("");
    let beats = node.data.get("scriptBeats").and_then(|v| v.as_array());
    let summary = if let Some(beats) = beats {
        let descriptions: Vec<&str> = beats
            .iter()
            .filter_map(|b| b.get("description").and_then(|d| d.as_str()))
            .collect();
        truncate(&descriptions.join("；"), 500)
    } else {
        truncate(prompt, 500)
    };
    let keywords = beats
        .into_iter()
        .flat_map(|arr| arr.iter())
        .filter_map(|b| b.get("character").and_then(|c| c.as_str()).map(String::from))
        .collect();
    AssetCard {
        node_id: node.id.clone(),
        node_type: node.node_type.clone(),
        label: truncate(prompt, 30),
        summary,
        keywords,
        references: Vec::new(),
    }
}

fn extract_image_card(node: &FlowNode) -> AssetCard {
    let params = node.data.get("params").cloned().unwrap_or(json!({}));
    let prompt = params.get("prompt").and_then(|v| v.as_str()).unwrap_or("");
    let path = node.data.get("path").and_then(|v| v.as_str()).unwrap_or("");
    AssetCard {
        node_id: node.id.clone(),
        node_type: node.node_type.clone(),
        label: truncate(prompt, 30),
        summary: truncate(prompt, 500),
        keywords: Vec::new(),
        references: if path.is_empty() { Vec::new() } else { vec![path.to_string()] },
    }
}

fn extract_video_card(node: &FlowNode) -> AssetCard {
    let params = node.data.get("params").cloned().unwrap_or(json!({}));
    let prompt = params.get("prompt").and_then(|v| v.as_str()).unwrap_or("");
    let path = node.data.get("path").and_then(|v| v.as_str()).unwrap_or("");
    AssetCard {
        node_id: node.id.clone(),
        node_type: node.node_type.clone(),
        label: truncate(prompt, 30),
        summary: truncate(prompt, 500),
        keywords: Vec::new(),
        references: if path.is_empty() { Vec::new() } else { vec![path.to_string()] },
    }
}

fn extract_audio_card(node: &FlowNode) -> AssetCard {
    let params = node.data.get("params").cloned().unwrap_or(json!({}));
    let text = params.get("text").and_then(|v| v.as_str()).unwrap_or("");
    let path = node.data.get("path").and_then(|v| v.as_str()).unwrap_or("");
    AssetCard {
        node_id: node.id.clone(),
        node_type: node.node_type.clone(),
        label: truncate(text, 30),
        summary: truncate(text, 500),
        keywords: Vec::new(),
        references: if path.is_empty() { Vec::new() } else { vec![path.to_string()] },
    }
}

fn truncate(s: &str, max_chars: usize) -> String {
    if s.chars().count() <= max_chars {
        s.to_string()
    } else {
        let truncated: String = s.chars().take(max_chars).collect();
        truncated + "…"
    }
}
```

**文件**：`src-tauri/src/executor/graph_flow.rs` 顶部

确保有 `use std::collections::VecDeque;`（已有 `HashMap`, `HashSet`，需加 `VecDeque`）。

在已有的 `use std::collections::{HashMap, HashSet};` 行改为：

```rust
use std::collections::{HashMap, HashSet, VecDeque};
```

同时在现有 import 区域追加（与 `use crate::graph::{CanvasGraph, FlowNode};` 并列）：

```rust
use super::types::AssetCard;
```

**验证**：`cargo check --manifest-path src-tauri/Cargo.toml` 编译通过。

---

## Step 3：llm.rs 新增公共请求构建 + 完整响应解析 + SSE 流式

### 3a：抽取公共请求构建函数

**文件**：`src-tauri/src/executor/llm.rs`

在 `openai_chat_completion` 函数**之后**、`pick_provider` 函数**之前**，新增：

> **重构说明**：`openai_chat_completion` 现有的 provider 解析 + body 构建逻辑与 `build_llm_request_parts` 高度重复。
> **需要将 `openai_chat_completion` 重构为调用 `build_llm_request_parts`**，仅保留 HTTP 调用 + content 提取部分。
> 新增的 `tools`/`stream` 过滤不影响现有功能（`openai_chat_completion` 不使用这两个字段）。
> 重构后 `openai_chat_completion` 变为：
>
> ```rust
> pub async fn openai_chat_completion(
>     http: &reqwest::Client,
>     settings: &AppSettings,
>     messages: serde_json::Value,
>     extra_params: &serde_json::Value,
> ) -> Result<String, String> {
>     let (_provider, api_key, url, body) = build_llm_request_parts(settings, messages, extra_params)?;
>
>     let resp = http
>         .post(&url)
>         .header("Authorization", format!("Bearer {}", api_key))
>         .json(&body)
>         .send()
>         .await
>         .map_err(|e| e.to_string())?;
>
>     let status = resp.status();
>     let text = resp.text().await.map_err(|e| e.to_string())?;
>     let parsed: serde_json::Value =
>         serde_json::from_str(&text).unwrap_or_else(|_| json!({ "raw": text }));
>
>     if !status.is_success() {
>         return Err(format!(
>             "LLM API 失败: {}",
>             serde_json::to_string(&parsed).unwrap_or_default()
>         ));
>     }
>
>     let content = parsed
>         .pointer("/choices/0/message/content")
>         .and_then(|v| v.as_str())
>         .unwrap_or("")
>         .to_string();
>
>     Ok(content)
> }
> ```

```rust
/// 公共函数：解析 provider / API key / model override / extra_params，
/// 构建请求 body 和 URL。三个 LLM 调用函数共享此逻辑，避免重复代码。
pub(crate) fn build_llm_request_parts(
    settings: &AppSettings,
    messages: serde_json::Value,
    extra_params: &serde_json::Value,
) -> Result<(ProviderConfig, String, String, serde_json::Value), String> {
    let provider_id_override = extra_params
        .get("providerId")
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());
    let provider = if let Some(pid) = provider_id_override {
        settings
            .providers
            .iter()
            .find(|p| p.enabled && p.id == pid)
            .cloned()
            .ok_or_else(|| format!("所选 Provider 不可用：{}", pid))?
    } else {
        pick_provider(settings)?
    };
    let api_key = vault::get_api_key(&provider.id)?
        .ok_or_else(|| format!("未配置 API Key：{}", provider.label))?;
    let model_override = extra_params
        .get("model")
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());

    let mut body = json!({
        "model": model_override.unwrap_or_else(|| provider.model.clone()),
        "messages": messages,
    });
    if let Some(obj) = body.as_object_mut() {
        if let serde_json::Value::Object(p) = extra_params.clone() {
            for (k, v) in p {
                if k != "model" && k != "messages" && k != "providerId" && k != "tools" && k != "stream" {
                    obj.insert(k, v);
                }
            }
        }
    }

    let url = format!(
        "{}/chat/completions",
        provider.base_url.trim_end_matches('/')
    );

    Ok((provider, api_key, url, body))
}
```

### 3b：完整响应解析函数（含 tool_calls）

在同一文件 `pick_provider` 函数之后追加：

```rust
/// 与 openai_chat_completion 相同的调用逻辑，但返回完整的 LlmResponse（含 tool_calls）。
pub async fn openai_chat_completion_full(
    http: &reqwest::Client,
    settings: &AppSettings,
    messages: serde_json::Value,
    tools: Option<serde_json::Value>,
    extra_params: &serde_json::Value,
) -> Result<super::types::LlmResponse, String> {
    use super::types::{LlmResponse, ToolCall};

    let (_provider, api_key, url, mut body) = build_llm_request_parts(settings, messages, extra_params)?;
    if let Some(tools_value) = tools {
        body.as_object_mut()
            .map(|obj| obj.insert("tools".into(), tools_value));
    }

    let resp = http
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;
    let parsed: serde_json::Value =
        serde_json::from_str(&text).unwrap_or_else(|_| json!({ "raw": text }));

    if !status.is_success() {
        return Err(format!(
            "LLM API 失败: {}",
            serde_json::to_string(&parsed).unwrap_or_default()
        ));
    }

    let content = parsed
        .pointer("/choices/0/message/content")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let finish_reason = parsed
        .pointer("/choices/0/finish_reason")
        .and_then(|v| v.as_str())
        .unwrap_or("stop")
        .to_string();

    let tool_calls: Vec<ToolCall> = parsed
        .pointer("/choices/0/message/tool_calls")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|tc| {
                    let id = tc.get("id")?.as_str()?.to_string();
                    let fn_obj = tc.get("function")?;
                    let name = fn_obj.get("name")?.as_str()?.to_string();
                    let args_str = fn_obj.get("arguments")?.as_str().unwrap_or("{}");
                    let arguments: serde_json::Value =
                        serde_json::from_str(args_str).unwrap_or(json!({}));
                    Some(ToolCall { id, name, arguments })
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(LlmResponse {
        content,
        tool_calls,
        finish_reason,
    })
}
```

### 3c：SSE 流式解析函数

继续追加：

```rust
/// SSE 流式调用 OpenAI chat/completions，通过 app.emit 逐 token 推送到前端。
/// 如果流式调用失败（Provider 不支持 SSE），自动降级为非流式调用。
///
/// **v1 限制**：不支持 `tool_calls` 的流式增量解析（delta/tool_calls）。
/// Hermes v1 不使用 tools，无影响。v2 如需 tool_calls 流式需扩展此函数。
pub async fn openai_chat_completion_stream(
    app: &tauri::AppHandle,
    http: &reqwest::Client,
    settings: &AppSettings,
    messages: serde_json::Value,
    tools: Option<serde_json::Value>,
    extra_params: &serde_json::Value,
    event_prefix: &str,
) -> Result<String, String> {
    use futures_util::StreamExt;

    let (_provider, api_key, url, mut body) = build_llm_request_parts(settings, messages.clone(), extra_params)?;
    body.as_object_mut().map(|obj| obj.insert("stream".into(), json!(true)));
    if let Some(tools_value) = tools {
        body.as_object_mut()
            .map(|obj| obj.insert("tools".into(), tools_value));
    }

    let resp = http
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.map_err(|e| e.to_string())?;
        return Err(format!("LLM API 失败: {}", text));
    }

    // 检查 Content-Type 判断是否真的返回了 SSE 流
    let content_type = resp.headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !content_type.contains("text/event-stream") {
        // Provider 不支持流式，降级为非流式
        let text = resp.text().await.map_err(|e| e.to_string())?;
        let parsed: serde_json::Value =
            serde_json::from_str(&text).unwrap_or_else(|_| json!({ "raw": text }));
        let content = parsed
            .pointer("/choices/0/message/content")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let _ = app.emit(
            &format!("{}:done", event_prefix),
            serde_json::json!({ "fullContent": content }),
        );
        return Ok(content);
    }

    let mut full_content = String::new();
    let mut stream = resp.bytes_stream();
    let mut byte_buffer: Vec<u8> = Vec::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        byte_buffer.extend_from_slice(&chunk);

        // 在字节级别查找 \n\n 边界，避免 UTF-8 截断问题
        while let Some(pos) = byte_buffer.windows(2).position(|w| w == b"\n\n") {
            let line_bytes = byte_buffer[..pos].to_vec();
            byte_buffer = byte_buffer[pos + 2..].to_vec();
            let line = String::from_utf8_lossy(&line_bytes);

            for sub in line.lines() {
                let sub = sub.trim();
                if !sub.starts_with("data: ") {
                    continue;
                }
                let data = &sub[6..];
                if data == "[DONE]" {
                    let _ = app.emit(
                        &format!("{}:done", event_prefix),
                        serde_json::json!({ "fullContent": full_content }),
                    );
                    return Ok(full_content);
                }
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(delta) = parsed.pointer("/choices/0/delta/content") {
                        if let Some(text) = delta.as_str() {
                            full_content.push_str(text);
                            let _ = app.emit(
                                &format!("{}:token", event_prefix),
                                serde_json::json!({ "token": text }),
                            );
                        }
                    }
                }
            }
        }
    }

    let _ = app.emit(
        &format!("{}:done", event_prefix),
        serde_json::json!({ "fullContent": full_content }),
    );
    Ok(full_content)
}
```

### 3d：Cargo.toml 新增依赖

**文件**：`src-tauri/Cargo.toml`

在 `[dependencies]` 中追加：

```toml
futures-util = "0.3"
```

**同时修改** `reqwest` 行，添加 `"stream"` feature（原行缺少此 feature，`bytes_stream()` 方法编译需要）：

将：
```toml
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
```

改为：
```toml
reqwest = { version = "0.12", features = ["json", "stream", "rustls-tls"], default-features = false }
```

**验证**：`cargo check --manifest-path src-tauri/Cargo.toml` 编译通过。

---

## Step 4：更新 executor/mod.rs 导出

**文件**：`src-tauri/src/executor/mod.rs`

替换为：

```rust
//! 画布 DAG 执行：拓扑运行、脚本解析、LLM、FFmpeg 拼接等。

mod engine;
mod ffmpeg;
mod graph_flow;
mod llm;
mod script_node;
mod script_parse;
mod types;

pub use engine::{run_graph, run_graph_with_patch, run_subgraph, run_subgraph_with_patch};
pub use llm::{openai_chat_completion, openai_chat_completion_full, openai_chat_completion_stream};
pub use types::{AssetCard, GraphRunResult, LlmResponse, NodeDataPatch, ToolCall};

#[cfg(test)]
mod tests;
```

**验证**：`cargo check --manifest-path src-tauri/Cargo.toml` 编译通过。

---

## Step 5：新增 hermes_agent.rs — 无状态 Agent 核心

**文件**：`src-tauri/src/executor/hermes_agent.rs`（新建）

```rust
//! Hermes Agent：基于画布 DAG 的无状态智能体。
//!
//! 核心原则：
//! - 画布状态即上下文：运行时遍历 DAG 提取上游资产卡
//! - 资产引用即约束：结构化 AssetCard 替代字符串摘要
//! - 每次调用无状态：无需 Pipeline Session，无需 DB 持久化
//!
//! 两种模式：
//! 1. enhance_prompt — 带上游资产卡优化节点提示词
//! 2. chat / chat_stream — 多轮对话，逐 token 流式推送

use crate::executor::graph_flow::{all_upstream_asset_cards, upstream_asset_cards};
use crate::executor::types::AssetCard;
use crate::executor::{openai_chat_completion_full, openai_chat_completion_stream};
use crate::graph::CanvasGraph;
use crate::settings::AppSettings;
use serde_json::json;

/// 每种节点类型对应的 AI 角色
pub fn node_type_system_prompt(node_type: &str) -> &'static str {
    match node_type {
        "textNode" | "llm" => STORY_ARCHITECT_PROMPT,
        "scriptNode" => SCRIPT_DOCTOR_PROMPT,
        "imageNode" | "imageAsset" => IMAGE_DIRECTOR_PROMPT,
        "videoNode" => VIDEO_CINEMATOGRAPHER_PROMPT,
        "audioNode" => AUDIO_DESIGNER_PROMPT,
        _ => GENERAL_ASSISTANT_PROMPT,
    }
}

const STORY_ARCHITECT_PROMPT: &str = r#"你是「故事建筑师」，负责帮用户从模糊的想法构建完整的故事大纲。

你的职责：
1. 理解用户的核心创意意图，哪怕描述很模糊
2. 扩展为有结构的故事大纲：角色、场景、冲突、高潮、结局
3. 确保故事适合影视化表达（画面感强、节奏明确）
4. 输出格式清晰，便于下游脚本节点拆分镜头

输出要求：
- 如果用户描述很短，主动补全角色动机和场景细节
- 保持创意的一致性，不要随意改变用户的核心设定
- 用中文输出"#;

const SCRIPT_DOCTOR_PROMPT: &str = r#"你是「脚本医生」，负责将故事大纲拆分为可执行的影视脚本镜头。

上游资产卡中包含了完整的故事大纲信息。

你的职责：
1. 将故事拆分为具体的镜头（场次、景别、时长、描述）
2. 确保镜头之间的连贯性和叙事节奏
3. 每个镜头描述必须画面感强，便于下游图片/视频节点生成
4. 保持角色一致性（外貌、服装、位置不要矛盾）

输出要求：
- 镜头描述要具体到可以生成画面的程度
- 标注景别（特写/中景/全景）和镜头运动（推/拉/摇/移）
- 用中文输出"#;

const IMAGE_DIRECTOR_PROMPT: &str = r#"你是「视觉导演」，负责将脚本镜头描述转化为高质量的图片生成提示词。

上游资产卡中包含了故事大纲和脚本镜头信息。

你的职责：
1. 将中文镜头描述转化为专业的图片生成提示词
2. 保持画面风格一致性（同一场景色调、光影、构图风格统一）
3. 补充技术参数：画面比例、分辨率、艺术风格关键词
4. 如果用户提示词太模糊，根据上游资产卡自动补全

输出要求：
- 提示词要具体、有画面感、包含光影和构图信息
- 英文输出图片提示词（文生图模型通常英文效果更好）
- 保持与上游角色描述的外貌一致性"#;

const VIDEO_CINEMATOGRAPHER_PROMPT: &str = r#"你是「电影摄影师」，负责将图片和脚本描述转化为高质量的视频生成提示词。

上游资产卡中包含了故事大纲、脚本镜头、已生成的图片描述。

你的职责：
1. 基于已有图片和脚本，补充镜头运动和过渡
2. 确保视频内容与参考图片保持一致
3. 添加合适的摄像机运动（推/拉/摇/移/跟）和时间节奏
4. 保持与上下游的视觉风格统一

输出要求：
- 视频提示词要包含画面内容+镜头运动+时长暗示
- 英文输出视频提示词
- 如果有参考图，说明画面应该与参考图保持一致"#;

const AUDIO_DESIGNER_PROMPT: &str = r#"你是「声音设计师」，负责为影视片段匹配合适的音频。

上游资产卡中包含了完整的故事、脚本、画面风格和视频节奏。

你的职责：
1. 根据场景氛围选择合适的音色和语速
2. 确保 TTS 语音的情感与画面情绪匹配
3. 如需背景音乐，推荐匹配的风格和节奏
4. 保持整体音频风格的一致性

输出要求：
- TTS 文案要自然、有情感
- 标注语速、情感风格
- 用中文输出"#;

const GENERAL_ASSISTANT_PROMPT: &str = r#"你是 CanvasFlow AI Studio 的智能助手，帮助用户优化节点参数。

你可以：
1. 优化用户输入的提示词，使其更专业、更具体
2. 根据上下文补全模糊的描述
3. 给出专业的创作建议

输出要求：用中文输出"#;

/// 将资产卡列表格式化为 LLM 可理解的上游上下文文本
fn format_asset_cards_as_context(cards: &[AssetCard]) -> String {
    if cards.is_empty() {
        return String::new();
    }
    let mut parts = vec!["## 上游制作管线上下文\n".to_string()];
    for card in cards {
        let type_label = match card.node_type.as_str() {
            "textNode" | "llm" => "故事大纲",
            "scriptNode" => "脚本镜头",
            "imageNode" | "imageAsset" => "图片资产",
            "videoNode" => "视频资产",
            "audioNode" => "音频资产",
            _ => &card.node_type,
        };
        parts.push(format!("### {} [{}]", type_label, card.label));
        if !card.summary.is_empty() {
            parts.push(format!("{}", card.summary));
        }
        if !card.keywords.is_empty() {
            parts.push(format!("关键词：{}", card.keywords.join("、")));
        }
        if !card.references.is_empty() {
            parts.push(format!("引用资产：{}", card.references.join(", ")));
        }
        parts.push(String::new()); // 空行分隔
    }
    parts.join("\n")
}

/// 构建 Agent 消息列表
pub fn build_hermes_messages(
    system_prompt: &str,
    asset_cards: &[AssetCard],
    user_message: &str,
    chat_history: &[serde_json::Value],
) -> serde_json::Value {
    let mut system_content = system_prompt.to_string();
    let ctx = format_asset_cards_as_context(asset_cards);
    if !ctx.is_empty() {
        system_content.push_str("\n\n");
        system_content.push_str(&ctx);
    }

    let mut messages = vec![json!({ "role": "system", "content": system_content })];
    messages.extend(chat_history.iter().cloned());
    messages.push(json!({ "role": "user", "content": user_message }));

    json!(messages)
}

/// Enhance 模式：单次 LLM 调用优化提示词
pub async fn enhance_prompt(
    http: &reqwest::Client,
    settings: &AppSettings,
    graph: &CanvasGraph,
    node_id: &str,
    current_prompt: &str,
    extra_params: &serde_json::Value,
) -> Result<String, String> {
    let node_type = graph.nodes.iter()
        .find(|n| n.id == node_id)
        .map(|n| n.node_type.as_str())
        .unwrap_or("unknown");
    let system_prompt = node_type_system_prompt(node_type);
    let cards = all_upstream_asset_cards(graph, node_id);
    let messages = build_hermes_messages(
        system_prompt,
        &cards,
        &format!(
            "请优化以下提示词，使其更专业、更具体、更适合高质量生成。只输出优化后的提示词，不要解释：\n\n{}",
            current_prompt
        ),
        &[],
    );
    let response = openai_chat_completion_full(http, settings, messages, None, extra_params).await?;
    response.content.ok_or_else(|| "LLM 未返回内容".into())
}

/// Chat 模式：多轮对话（非流式，预留接口，v1 未暴露 Tauri Command）
pub async fn chat(
    http: &reqwest::Client,
    settings: &AppSettings,
    graph: &CanvasGraph,
    node_id: &str,
    user_message: &str,
    chat_history: &[serde_json::Value],
    extra_params: &serde_json::Value,
) -> Result<String, String> {
    let node_type = graph.nodes.iter()
        .find(|n| n.id == node_id)
        .map(|n| n.node_type.as_str())
        .unwrap_or("unknown");
    let system_prompt = node_type_system_prompt(node_type);
    let cards = all_upstream_asset_cards(graph, node_id);
    let messages = build_hermes_messages(system_prompt, &cards, user_message, chat_history);
    let response = openai_chat_completion_full(http, settings, messages, None, extra_params).await?;
    response.content.ok_or_else(|| "LLM 未返回内容".into())
}

/// Chat 流式模式：逐 token 推送
pub async fn chat_stream(
    app: &tauri::AppHandle,
    http: &reqwest::Client,
    settings: &AppSettings,
    graph: &CanvasGraph,
    node_id: &str,
    user_message: &str,
    chat_history: &[serde_json::Value],
    extra_params: &serde_json::Value,
    event_prefix: &str,
) -> Result<String, String> {
    let node_type = graph.nodes.iter()
        .find(|n| n.id == node_id)
        .map(|n| n.node_type.as_str())
        .unwrap_or("unknown");
    let system_prompt = node_type_system_prompt(node_type);
    let cards = all_upstream_asset_cards(graph, node_id);
    let messages = build_hermes_messages(system_prompt, &cards, user_message, chat_history);
    openai_chat_completion_stream(app, http, settings, messages, None, extra_params, event_prefix).await
}
```

**文件**：`src-tauri/src/executor/mod.rs`

在 `mod` 声明中追加：

```rust
pub mod hermes_agent;
```

**验证**：`cargo check --manifest-path src-tauri/Cargo.toml` 编译通过。

---

## Step 6：新增 hermes_cmd.rs — 仅 2 个 Tauri Commands

**文件**：`src-tauri/src/commands/hermes_cmd.rs`（新建）

```rust
use crate::executor::hermes_agent;
use crate::graph::CanvasGraph;
use crate::settings;
use crate::AppState;
use serde_json::json;

/// 从前端传入的画布 JSON 中解析出 CanvasGraph
fn parse_graph(graph_json: serde_json::Value) -> Result<CanvasGraph, String> {
    serde_json::from_value(graph_json).map_err(|e| format!("画布 JSON 解析失败：{}", e))
}

#[tauri::command]
pub async fn hermes_enhance(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    graph_json: serde_json::Value,
    node_id: String,
    current_prompt: String,
    extra_params: Option<serde_json::Value>,
) -> Result<String, String> {
    let s = settings::load_settings(&app)?;
    let graph = parse_graph(graph_json)?;
    let extra = extra_params.unwrap_or(json!({}));
    hermes_agent::enhance_prompt(
        &state.http,
        &s,
        &graph,
        &node_id,
        &current_prompt,
        &extra,
    )
    .await
}

#[tauri::command]
pub async fn hermes_chat_stream(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    graph_json: serde_json::Value,
    node_id: String,
    user_message: String,
    chat_history: Vec<serde_json::Value>,
    extra_params: Option<serde_json::Value>,
) -> Result<String, String> {
    let s = settings::load_settings(&app)?;
    let graph = parse_graph(graph_json)?;
    let extra = extra_params.unwrap_or(json!({}));
    let event_prefix = format!("hermes-chat:{}", node_id);
    hermes_agent::chat_stream(
        &app,
        &state.http,
        &s,
        &graph,
        &node_id,
        &user_message,
        &chat_history,
        &extra,
        &event_prefix,
    )
    .await
}
```

**文件**：`src-tauri/src/commands/mod.rs`

追加：

```rust
pub mod hermes_cmd;
```

**文件**：`src-tauri/src/lib.rs`

在 `invoke_handler` 宏的命令列表中追加：

```rust
            commands::hermes_cmd::hermes_enhance,
            commands::hermes_cmd::hermes_chat_stream,
```

**验证**：

```bash
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

两个命令都必须通过。

---

## Step 7：前端 hermesStore.ts

**文件**：`src/store/hermesStore.ts`（新建）

```typescript
import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";

// ─── Types ──────────────────────────────────────────────────

export type AssetCard = {
  nodeId: string;
  nodeType: string;
  label: string;
  summary: string;
  keywords: string[];
  references: string[];
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type HermesState = {
  /** 每个节点的聊天历史 nodeId → ChatMessage[] */
  chatHistories: Record<string, ChatMessage[]>;
  /** 每个节点的 AI 状态：idle / enhancing / chatting */
  agentStates: Record<string, "idle" | "enhancing" | "chatting">;
  /** 每个节点的流式输出缓冲 */
  streamingBuffers: Record<string, string>;

  // ─── Actions ──────────────────────────────────────
  enhancePrompt: (
    graphJson: object,
    nodeId: string,
    currentPrompt: string,
    extraParams?: Record<string, unknown>,
  ) => Promise<string>;
  sendChatStream: (
    graphJson: object,
    nodeId: string,
    userMessage: string,
    extraParams?: Record<string, unknown>,
  ) => Promise<string>;
  setAgentState: (nodeId: string, state: "idle" | "enhancing" | "chatting") => void;
  appendStreamToken: (nodeId: string, token: string) => void;
  clearStreamBuffer: (nodeId: string) => void;
  clearChatHistory: (nodeId: string) => void;
  getChatHistory: (nodeId: string) => ChatMessage[];
};

export const useHermesStore = create<HermesState>((set, get) => ({
  chatHistories: {},
  agentStates: {},
  streamingBuffers: {},

  enhancePrompt: async (graphJson, nodeId, currentPrompt, extraParams) => {
    get().setAgentState(nodeId, "enhancing");
    try {
      const enhanced = await invoke<string>("hermes_enhance", {
        graphJson,
        nodeId,
        currentPrompt,
        extraParams: extraParams ?? null,
      });
      get().setAgentState(nodeId, "idle");
      return enhanced;
    } catch (e) {
      get().setAgentState(nodeId, "idle");
      throw e;
    }
  },

  sendChatStream: (graphJson: object, nodeId: string, userMessage: string, extraParams?: Record<string, unknown>) => {
    return new Promise<string>((resolve, reject) => {
      get().setAgentState(nodeId, "chatting");
      get().clearStreamBuffer(nodeId);

      // 追加用户消息
      set((s) => ({
        chatHistories: {
          ...s.chatHistories,
          [nodeId]: [...(s.chatHistories[nodeId] ?? []), { role: "user" as const, content: userMessage }],
        },
      }));

      const eventPrefix = `hermes-chat:${nodeId}`;
      let resolved = false;

      const cleanup = () => {
        unlistenTokenFn?.();
        unlistenDoneFn?.();
      };
      let unlistenTokenFn: (() => void) | null = null;
      let unlistenDoneFn: (() => void) | null = null;

      // 监听流式 token
      (async () => {
        const { listen } = await import("@tauri-apps/api/event");
        const unlisten = await listen<{ token: string }>(`${eventPrefix}:token`, (event) => {
          get().appendStreamToken(nodeId, event.payload.token);
        });
        unlistenTokenFn = unlisten;
      })();

      // 监听完成 — 在 :done 回调中更新历史、重置状态、清理监听器
      (async () => {
        const { listen } = await import("@tauri-apps/api/event");
        const unlisten = await listen<{ fullContent: string }>(`${eventPrefix}:done`, (event) => {
          const fullContent = event.payload.fullContent;
          set((s) => ({
            chatHistories: {
              ...s.chatHistories,
              [nodeId]: [...(s.chatHistories[nodeId] ?? []), { role: "assistant" as const, content: fullContent }],
            },
          }));
          get().setAgentState(nodeId, "idle");
          get().clearStreamBuffer(nodeId);
          cleanup();
          if (!resolved) {
            resolved = true;
            resolve(fullContent);
          }
        });
        unlistenDoneFn = unlisten;
      })();

      // 发起 invoke 调用
      const history = get().chatHistories[nodeId] ?? [];
      const chatHistoryJson = history.map((m) => ({ role: m.role, content: m.content }));
      invoke<string>("hermes_chat_stream", {
        graphJson,
        nodeId,
        userMessage,
        chatHistory: chatHistoryJson,
        extraParams: extraParams ?? null,
      }).catch((e) => {
        // 回滚用户消息
        set((s) => ({
          chatHistories: {
            ...s.chatHistories,
            [nodeId]: (s.chatHistories[nodeId] ?? []).slice(0, -1),
          },
        }));
        get().setAgentState(nodeId, "idle");
        get().clearStreamBuffer(nodeId);
        cleanup();
        if (!resolved) {
          resolved = true;
          reject(e);
        }
      });
    });
  },

  setAgentState: (nodeId, state) => {
    set((s) => ({ agentStates: { ...s.agentStates, [nodeId]: state } }));
  },

  appendStreamToken: (nodeId, token) => {
    set((s) => ({
      streamingBuffers: { ...s.streamingBuffers, [nodeId]: (s.streamingBuffers[nodeId] ?? "") + token },
    }));
  },

  clearStreamBuffer: (nodeId) => {
    set((s) => {
      const next = { ...s.streamingBuffers };
      delete next[nodeId];
      return { streamingBuffers: next };
    });
  },

  clearChatHistory: (nodeId) => {
    set((s) => {
      const next = { ...s.chatHistories };
      delete next[nodeId];
      return { chatHistories: next };
    });
  },

  getChatHistory: (nodeId) => get().chatHistories[nodeId] ?? [],
}));
```

**验证**：`npm run typecheck` 无错误。

---

## Step 8：前端 NodeAgentStrip.tsx

**文件**：`src/components/nodes/NodeAgentStrip.tsx`（新建）

```typescript
import { useState, useRef, useEffect, useCallback } from "react";
import { useHermesStore } from "@/store/hermesStore";
import { useProjectStore } from "@/store/projectStore";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";

type NodeAgentStripProps = {
  nodeId: string;
  nodeType: string;
  /** 获取当前提示词值 */
  getPrompt: () => string;
  /** 设置提示词值 */
  setPrompt: (value: string) => void;
};

const NODE_TYPE_LABELS: Record<string, string> = {
  textNode: "故事建筑师",
  llm: "故事建筑师",
  scriptNode: "脚本医生",
  imageNode: "视觉导演",
  imageAsset: "视觉导演",
  videoNode: "电影摄影师",
  audioNode: "声音设计师",
};

/** 从 projectStore 提取画布 JSON 供后端使用 */
function getGraphJson(): object {
  const s = useProjectStore.getState();
  return { nodes: s.nodes, edges: s.edges };
}

export function NodeAgentStrip({
  nodeId,
  nodeType,
  getPrompt,
  setPrompt,
}: NodeAgentStripProps) {
  const agentState = useHermesStore((s) => s.agentStates[nodeId] ?? "idle");
  const streamingBuffer = useHermesStore((s) => s.streamingBuffers[nodeId] ?? "");
  const chatHistory = useHermesStore((s) => s.chatHistories[nodeId] ?? []);
  const enhancePrompt = useHermesStore((s) => s.enhancePrompt);
  const sendChatStream = useHermesStore((s) => s.sendChatStream);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const busy = agentState !== "idle";
  const nodeLabel = NODE_TYPE_LABELS[nodeType] ?? "AI 助手";

  // 自动滚动到最新消息
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, streamingBuffer]);

  // Enhance 模式
  const handleEnhance = useCallback(async () => {
    if (busy) return;
    const current = getPrompt();
    if (!current.trim()) return;
    try {
      const enhanced = await enhancePrompt(getGraphJson(), nodeId, current);
      setPrompt(enhanced);
    } catch (e) {
      console.error("Enhance failed:", e);
    }
  }, [busy, getPrompt, setPrompt, enhancePrompt, nodeId]);

  // Chat 模式
  const handleSendChat = useCallback(async () => {
    if (busy || !chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatInput("");
    try {
      await sendChatStream(getGraphJson(), nodeId, msg);
    } catch (e) {
      console.error("Chat failed:", e);
    }
  }, [busy, chatInput, sendChatStream, nodeId]);

  return (
    <div className={`nodeAgentStrip ${RF_NODE_INPUT_CLASS}`} onPointerDown={(e) => e.stopPropagation()}>
      {/* 顶部状态栏 */}
      <div className="nodeAgentStripBar">
        <span className="nodeAgentStripLabel">
          {nodeLabel}
        </span>
        <span className="nodeAgentStripSpacer" />
        <button
          type="button"
          className="nodeAgentStripBtn"
          disabled={busy || !getPrompt().trim()}
          title="一键优化当前提示词"
          onClick={() => void handleEnhance()}
        >
          {agentState === "enhancing" ? "优化中…" : "优化"}
        </button>
        <button
          type="button"
          className="nodeAgentStripBtn"
          disabled={busy}
          title="打开智能对话"
          onClick={() => setChatOpen(!chatOpen)}
        >
          {chatOpen ? "收起" : "对话"}
        </button>
      </div>

      {/* 对话面板 */}
      {chatOpen && (
        <div className="nodeAgentStripChat">
          <div className="nodeAgentStripChatMessages">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`nodeAgentStripChatMsg nodeAgentStripChatMsg--${msg.role}`}>
                {msg.content}
              </div>
            ))}
            {streamingBuffer && (
              <div className="nodeAgentStripChatMsg nodeAgentStripChatMsg--assistant">
                {streamingBuffer}
                <span className="nodeAgentStripCursor" aria-hidden>▊</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="nodeAgentStripChatInput">
            <input
              className={`nodeAgentStripChatInputField ${RF_NODE_INPUT_CLASS}`}
              placeholder="描述你想要的画面、感觉、风格…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSendChat();
                }
              }}
            />
            <button
              type="button"
              className="nodeAgentStripChatSend"
              disabled={busy || !chatInput.trim()}
              onClick={() => void handleSendChat()}
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**验证**：`npm run typecheck` 无错误。

---

## Step 9：集成到节点组件

### 9a：ImageGenerationPanel

**文件**：`src/components/nodes/ImageGenerationPanel.tsx`

在 import 区追加：

```typescript
import { NodeAgentStrip } from "@/components/nodes/NodeAgentStrip";
```

在 JSX 中，找到 `<div className="imageGenPanelFoot">` 这行，**在其前面**插入：

```tsx
      {/* AI 智能面板 */}
      <NodeAgentStrip
        nodeId={nodeId}
        nodeType="imageNode"
        getPrompt={() => prompt}
        setPrompt={(v) => updateNodeData(nodeId, { prompt: v.slice(0, IMAGE_GENERATION_PROMPT_MAX_CHARS) })}
      />
```

### 9b：TextNode

**文件**：`src/components/nodes/TextNode.tsx`

在 import 区追加：

```typescript
import { NodeAgentStrip } from "@/components/nodes/NodeAgentStrip";
```

在组件 JSX 底部（return 闭合标签之前）合适位置追加：

```tsx
        <NodeAgentStrip
          nodeId={id}
          nodeType="textNode"
          getPrompt={() => modelInput || prompt}
          setPrompt={(v) => {
            if (modelInput) {
              mergeParams({ textModelInput: v });
            } else {
              updateNodeData(id, { prompt: v });
            }
          }}
        />
```

### 9c：ScriptNode

**文件**：`src/components/nodes/ScriptNode.tsx`

在 import 区追加：

```typescript
import { NodeAgentStrip } from "@/components/nodes/NodeAgentStrip";
```

在组件 JSX 底部追加：

```tsx
<NodeAgentStrip
  nodeId={id}
  nodeType="scriptNode"
  getPrompt={() => prompt}
  setPrompt={(v) => updateNodeData(id, { prompt: v })}
/>
```

> **变量名说明**：ScriptNode 中节点 ID 为 `id`（来自 `NodeProps`），主题提示词为 `prompt`（来自 `data.prompt ?? ""`）。

### 9d：AudioTtsPanel

**文件**：`src/components/nodes/AudioTtsPanel.tsx`

在 import 区追加：

```typescript
import { NodeAgentStrip } from "@/components/nodes/NodeAgentStrip";
```

在面板底部追加：

```tsx
<NodeAgentStrip
  nodeId={nodeId}
  nodeType="audioNode"
  getPrompt={() => prompt}
  setPrompt={(v) => updateNodeData(nodeId, { prompt: v.slice(0, MAX_CHARS) })}
/>
```

> **变量名说明**：AudioTtsPanel 中 `nodeId` 是 prop，`prompt` 来自 `node.data.prompt`（`MAX_CHARS` 截断），`MAX_CHARS` 即 `AUDIO_TTS_PROMPT_MAX_CHARS`（5000）。

### 9e：VideoAssetNode（视频节点）

**文件**：`src/components/nodes/VideoAssetNode.tsx`

视频节点的提示词存储在 `data.video.draft.prompt` 中（通过 `useTtvDraft` hook 管理），而非简单的 `data.prompt`。

在 import 区追加：

```typescript
import { NodeAgentStrip } from "@/components/nodes/NodeAgentStrip";
```

> **Cursor 执行提示**：VideoAssetNode 使用 `TextNodeTextToVideoPanel` 子组件处理文生视频流程，提示词通过 `useTtvDraft` hook 获取和更新。
> 请先 `Read` 以下文件确认 API：
> - `src/components/nodes/VideoAssetNode.tsx`
> - `src/hooks/useTtvDraft.ts`
> - `src/components/nodes/TextNodeWorkflowPanels.tsx`（`TextNodeTextToVideoPanel`）
>
> 集成方式：在 `TextNodeTextToVideoPanel` 组件内部添加 `NodeAgentStrip`，
> 因为提示词编辑 UI 在该子组件中。
>
> 大致代码：
> ```tsx
> <NodeAgentStrip
>   nodeId={videoNodeId}
>   nodeType="videoNode"
>   getPrompt={() => draftPrompt}
>   setPrompt={(v) => updateDraft({ prompt: v.slice(0, VIDEO_GENERATION_DRAFT_PROMPT_MAX_CHARS) })}
> />
> ```
>
> 具体变量名需根据 `TextNodeTextToVideoPanel` 内部上下文确认。

### 9f：LLMNode（不集成 v1）

`LLMNode.tsx` 是极简组件（24 行），只显示 prompt 预览，没有可编辑区域。与 TextNode 功能重叠。

**v1 不集成 LLMNode 的 NodeAgentStrip**。`extract_asset_card` 和 `node_type_system_prompt` 中对 `"llm"` 类型仍有处理，供后端资产卡提取使用，但前端不提供独立的 AI 面板。

**验证**：`npm run typecheck` 无错误。

---

## Step 10：NodeAgentStrip 样式

**文件**：`src/styles/global.css`（或项目主样式文件末尾）

追加：

```css
/* ─── NodeAgentStrip ────────────────────────────── */

.nodeAgentStrip {
  margin-top: 6px;
  border-top: 1px solid var(--color-border-tertiary);
  padding-top: 6px;
}

.nodeAgentStripBar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nodeAgentStripLabel {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.nodeAgentStripSpacer {
  flex: 1;
}

.nodeAgentStripBtn {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 6px;
  background: var(--color-background-primary);
  color: var(--color-text-primary);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}

.nodeAgentStripBtn:hover:not(:disabled) {
  background: var(--color-background-secondary);
}

.nodeAgentStripBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.nodeAgentStripChat {
  margin-top: 6px;
  border: 1px solid var(--color-border-tertiary);
  border-radius: 8px;
  overflow: hidden;
}

.nodeAgentStripChatMessages {
  max-height: 160px;
  overflow-y: auto;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nodeAgentStripChatMsg {
  font-size: 12px;
  line-height: 1.5;
  padding: 4px 8px;
  border-radius: 6px;
  max-width: 90%;
  word-break: break-word;
}

.nodeAgentStripChatMsg--user {
  align-self: flex-end;
  background: var(--color-background-info, #EEEDFE);
  color: var(--color-text-primary);
}

.nodeAgentStripChatMsg--assistant {
  align-self: flex-start;
  background: var(--color-background-secondary);
  color: var(--color-text-primary);
}

.nodeAgentStripCursor {
  animation: blink 0.8s step-end infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

.nodeAgentStripChatInput {
  display: flex;
  border-top: 1px solid var(--color-border-tertiary);
}

.nodeAgentStripChatInputField {
  flex: 1;
  border: none;
  padding: 4px 8px;
  font-size: 12px;
  background: transparent;
  color: var(--color-text-primary);
  outline: none;
}

.nodeAgentStripChatSend {
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 4px 8px;
  font-size: 14px;
}

.nodeAgentStripChatSend:hover:not(:disabled) {
  color: var(--color-text-primary);
}

.nodeAgentStripChatSend:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
```

**验证**：页面渲染正常，无样式冲突。

---

## Step 11：端到端场景验证

手动测试以下 3 个完整流程：

### 场景 1：故事 → 图片（资产卡上下文传递验证）

1. 创建 textNode，输入「一个女孩在雨中撑伞」
2. 点击「优化」→ Agent 应返回扩展后的故事描述
3. 创建 imageNode，连接到 textNode 下游
4. 在 imageNode 点击「优化」→ Agent 应自动引用上游故事内容
5. 验证：imageNode 的优化结果包含"雨中撑伞"等上游要素

### 场景 2：多轮对话（Chat 流式验证）

1. 在任意 imageNode 打开「对话」
2. 输入「我想做一个赛博朋克风格」
3. Agent 应流式返回专业建议
4. 继续对话「色调偏蓝紫」→ Agent 应在此基础上优化

### 场景 3：降级验证

1. LLM API 不可用时 → Enhance/Chat 按钮应显示错误，不影响节点原有功能
2. SSE 流式不可用 → 自动降级为非流式响应

---

## 管线上下文流转详解

| 到达节点 | Agent 看到哪些资产卡 | Agent 能做什么 |
|----------|---------------------|---------------|
| textNode（首个节点） | 无上游 | 把模糊想法扩展为完整故事大纲 |
| scriptNode | textNode 故事大纲 | 拆分为一致性的镜头列表 |
| imageNode | 故事大纲 + 脚本镜头 | 生成风格统一的视觉提示词 |
| videoNode | 故事 + 脚本 + 图片资产 | 添加匹配的镜头运动和过渡 |
| audioNode | 故事 + 脚本 + 画面节奏 | 匹配情感和节奏的音频方案 |

**关键**：越到下游，资产卡越多，Agent 越懂你的故事。这是碎片化 per-node AI 做不到的。

---

## Cargo.toml 依赖汇总

需要确保 `src-tauri/Cargo.toml` 的 `[dependencies]` 包含：

```toml
futures-util = "0.3"
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
rusqlite = { version = "0.32", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["json", "stream", "rustls-tls"], default-features = false }
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
tauri-plugin-dialog = "2"
```

> ⚠️ **注意**：
> - `reqwest` 必须带 `"stream"` feature，否则 `bytes_stream()` 无法编译。
> - `rusqlite` 保持项目现有版本 `0.32`。
> - `futures-util` 是唯一需要新增的依赖。

---

## 降级方案

1. **LLM API 失败** → Enhance/Chat 返回错误，catch 后不影响现有 nodeAgentRuntime 的 deterministic 执行
2. **流式 SSE 不可用** → `openai_chat_completion_stream` 自动降级：检测 Content-Type 非 `text/event-stream` 时，解析非流式响应返回
3. **画布无上游节点** → Agent 退化为无上下文的 per-node 模式，仍有基本增强能力
4. **画布 JSON 传参过大** → v1 直接传完整画布；v2 可优化为只传当前节点 + 上游子图

---

## 已知限制（v1）

| 限制 | 影响 | v2 计划 |
|------|------|---------|
| Chat 历史只存 Zustand 内存 | 页面刷新后丢失 | 存入 IndexedDB |
| 显式 @引用 UI 未实现 | 自动注入所有上游（含间接）资产卡 | 节点搜索 UI + 引用解析器 |
| Smart Generate 未实现 | 只有 Enhance + Chat 可用 | 质量校验 + 迭代循环 |
| 画布 JSON 全量传参 | 大型画布可能有性能问题 | 只传当前节点 + 上游子图 |
| 资产卡 keywords 未用 NER 提取 | keywords 为空或仅从 scriptBeats 提取 | LLM 实体提取 |
| SSE 不支持 tool_calls 流式 | v1 不用 tools，无影响 | v2 扩展流式解析 |
| videoNode 集成需确认 useTtvDraft API | Step 9e 提供了指导但未给出精确代码 | 实现时 Read 源码确认 |
| LLMNode 不集成 NodeAgentStrip | LLM 节点无 AI 面板 | 按需添加 |
