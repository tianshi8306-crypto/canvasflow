# 迭代 22 — Hermes Brain MVP（Phase B）

**层**：ProductionFlowLayer + ProviderOrchestrationLayer  
**核心目标**：内置 Hermes 侧栏通过 Tauri `invoke` 调用本地 Rust LLM，流式对话 + 画布 DAG 资产卡上下文。

## 功能点

1. Rust：`hermes_asset` / `hermes_agent` / `hermes_cmd`（`hermes_chat_stream`、`hermes_enhance`）  
2. `llm.rs` SSE 流式 + `hermes-chat-chunk|done|error` 事件  
3. 前端：`hermesBrain.ts`、`pickHermesProvider`、侧栏流式对话  
4. 对话历史 `localStorage` 按工程路径分桶（不写 `canvasflow.json`）

## 模块

| 模块 | 文件 |
|------|------|
| Rust | `src-tauri/src/executor/hermes_*.rs`、`commands/hermes_cmd.rs` |
| 前端 | `src/lib/hermes/hermesBrain.ts`、`HermesSidebar.tsx` |

## 非目标

- @ 引用节点、附件上传  
- 自动写回节点 prompt（仅「优化选中节点」通过对话展示结果）  
- Smart Generate 闭环  

## 手工验收

1. 设置中启用带 API Key 的对话服务商  
2. 打开 Hermes → 发送消息 → 流式出现回复（任务管理器无新端口监听）  
3. 选中脚本节点再问 → 回复应提及分镜/剧本上下文  
4. 「优化选中节点提示词」→ 返回优化文案  
5. 浏览器 `npm run dev` → 提示需 Tauri，不发起请求  

## 回滚

- 移除 `hermes_cmd` 注册与 `HermesSidebar` 内 Brain 调用，恢复 Phase A echo
