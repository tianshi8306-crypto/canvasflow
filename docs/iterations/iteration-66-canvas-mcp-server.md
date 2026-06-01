# Iteration 66 — T5 对外 Canvas MCP（stdio Server）

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §3.5 T5 · P2

## 1) 目标

将 Canvas 制片工具以 **MCP stdio Server** 暴露给 Cursor 等外部 Agent；执行仍落本地 `runHermesTool`。

## 2) 范围（3 模块）

- `canvasMcpTools.catalog.json` — 工具 schema 真源（11 工具）
- `canvas_mcp_bridge.rs` + `canvasflow-mcp-server.mjs` — HTTP 桥 + stdio Server
- `initHermesCanvasMcpBridge` + 设置面板配置片段

## 3) 架构

```text
Cursor MCP 子进程 (stdio)
    │ tools/call
    ▼
canvasflow-mcp-server.mjs
    │ HTTP POST 127.0.0.1:14230/tools/call
    ▼
Tauri 桥接层 emit → 前端 invokeHermesCanvasMcpTool → runHermesTool
```

## 4) 功能

1. App 启动监听 `14230`；`GET /health`、`GET /tools`、`POST /tools/call`
2. `npm run mcp:server` / Node 脚本对接 MCP 协议
3. 设置 → Agent →「对外 Canvas MCP」复制 Cursor 配置
4. 目录新增 `storyboard_patch_shot`、`film_workflow_check`

## 5) 非目标

- App 关闭后独立 headless 执行
- 远程网络暴露（仅 localhost）
- 与 iter-52 外接 MCP 客户端合并

## 6) 验收

1. App 打开工程 → `GET http://127.0.0.1:14230/health` 返回 `frontendReady: true`
2. Cursor 配置 mcp server 后 `tools/list` 可见 `script_generate_storyboard`
3. `tools/call` 成功改动画布（如 workflow_check 返回文本）
4. `npm run test -- canvasMcpToolsCatalog` 通过

## 7) 状态

✅ 已实现（iter-66 / P2-T5）
