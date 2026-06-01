# Hermes 自主影视 Agent 架构（对标 Nous Hermes Agent · 本地化）

> **目标**：CanvasFlow 内的 Hermes = **自主影视 Agent**  
> **通用知识** → 设置里的对话大模型 + 顾问模式 + 影视知识库 RAG  
> **专业技能** → 内置 Skills + 工程内 `.canvasflow/hermes/skills/*.md`  
> **指挥画布** → Canvas MCP 工具表 → `runHermesTool`（节点 SSOT，非外网 Agent 服务）

---

## 与 Nous Hermes Agent 的对照

| Nous 原装能力 | CanvasFlow Hermes（iter-45+） |
|---------------|-------------------------------|
| 持久记忆 MEMORY.md / SQLite FTS | 工程内 `.canvasflow/hermes/memory.json` + 用户技巧库 RAG |
| Skills 自进化 / agentskills.io | 内置 `HERMES_SKILLS` + 用户 Markdown Skills |
| 70+ 工具 + MCP | **Canvas MCP**（制片工具子集）→ 画布节点 |
| 子 Agent `delegate_task` | `agent.delegate_parallel`（最多 3 路并发） |
| Cron / 多平台 Gateway | 工程内 `automations.json` + App 打开时轮询 |
| 独立安装 / Telegram | **不采用**；仅 Tauri 主窗口 |

---

## 三层智能来源

```text
用户对话
  ├─ L0 大模型（设置 → 模型 → 文本）     … 通用知识、推理、泛问答
  ├─ L1 Skills（内置 + 用户 .md）       … 制片话术、Seedance、流程 SOP
  ├─ L2 记忆（memory.json + bible）      … 本工程长期事实与用户画像
  ├─ L3 知识库 RAG（hermes-knowledge）   … 行业文档片段
  └─ L4 Canvas MCP → runHermesTool       … 改节点、出图、出视频、导出
```

---

## 目录约定（每个工程）

```text
.canvasflow/hermes/
  memory.json          # 长期记忆 facts[]
  automations.json     # 定时制片任务
  skills/*.md          # 用户自定义 Skill（YAML frontmatter 可选）
```

用户级技巧仍可在 `.canvasflow/hermes-knowledge-user/`（设置可配根目录）。

---

## 对话指令

| 说法 | 作用 |
|------|------|
| 记住：… | 写入技巧库 + memory.json |
| 我的记忆 | 列出长期记忆 |
| 有哪些 skills | 列出技能 |
| Canvas MCP / 画布工具有哪些 | 工具表 |
| 每 30 分钟检查流程 | 创建自动化 |
| 并行出 1-6 镜图 | 子 Agent 分路出图 |

---

## 产品原则（已确认，见 [CANVAS_AGENT_SPEC.md](./CANVAS_AGENT_SPEC.md)）

1. **自主执行**：可无人确认改脚本/分镜/批量出图出视频；**设置 → Agent** 由用户开关，附风险说明。  
2. **并行优先**：**聊天不阻塞**出图/出视频（Job 队列），非多工程并行。

## 后续（iter-46+）

- iter-46：Agent 设置项 + 解除对话阻塞（第一步）  
- iter-47：Job 队列 + 任务轨  
- iter-48：Agent loop + 工作记忆 + 自动成功经验  

- 外接真实 MCP Server（stdio）  
- App 关闭仍跑 cron  

关联：[CANVAS_AGENT_SPEC.md](./CANVAS_AGENT_SPEC.md) · [HERMES.md](./HERMES.md) · [iteration-45](../iterations/iteration-45-hermes-autonomous-agent.md)
