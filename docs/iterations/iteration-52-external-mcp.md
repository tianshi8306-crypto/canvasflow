# Iteration 52 — 外接 MCP（stdio 客户端）

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §3.5 T5 · P2

## 1) 目标

在 Tauri 桌面端通过 **stdio 子进程**连接用户配置的外接 MCP Server，列举/调用其工具；与内置 Canvas MCP（`runHermesTool`）并存。

## 2) 范围

- Rust `mcp_stdio.rs` + `hermes_mcp_cmd`（list / call / probe）
- 设置 → Agent 下「外接 MCP」配置（command/args/测试连接）
- Hermes 对话：`外接 mcp 工具`、`调用 mcp <服务名> <工具名> [JSON]`
- Agent 上下文注入外接工具列表

## 3) 非目标

- 对外暴露 CanvasFlow 为 MCP Server（供 Cursor 连接）
- App 关闭后常驻 MCP 连接池
- 自动把外接工具结果写回画布（需用户/Hermes 显式调用）

## 4) 验收

1. 设置添加 `npx -y @modelcontextprotocol/server-filesystem .` → 测试连接成功
2. Hermes：「外接 mcp 工具」→ 列出 filesystem 工具
3. 「调用 mcp Filesystem list_directory {"path":"."}」→ 返回目录列表
4. 内置「画布 mcp 工具」仍列出 Canvas 制片工具

## 5) 状态

✅ 已实现（iter-52）
