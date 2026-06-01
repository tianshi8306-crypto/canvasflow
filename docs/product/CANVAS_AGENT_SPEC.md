# 画布 Agent P0 拍板摘要

> **完整规格**见 **[HERMES_CURSOR_AGENT_SPEC.md](./HERMES_CURSOR_AGENT_SPEC.md)**（Cursor-style Agent 产品真源）。  
> 本文仅保留 **已确认原则** 与 **iter-46～48 切片**，避免重复维护。

---

## 已确认原则

1. **自主执行**：可无人确认改脚本/分镜/批量出图出视频；**设置 → Agent** 开关 + 风险说明。  
2. **并行优先**：**聊天不阻塞**出图/出视频（Job 队列）；非多工程并行。

## 迭代切片

| 迭代 | 内容 |
|------|------|
| iter-46 | Agent 设置 + 执行中 consult 不阻塞 |
| iter-47 | Job 队列 + 轻量任务轨 |
| iter-48 | Agent loop + 工作记忆 + 自动成功经验 |
| iter-49 | 自动成功经验 + 反思写 memory/skill |
| iter-50 | 画布事件感知 + 主动建议 |

详见 [iteration-46](../iterations/iteration-46-agent-settings-nonblocking-chat.md) 起。
