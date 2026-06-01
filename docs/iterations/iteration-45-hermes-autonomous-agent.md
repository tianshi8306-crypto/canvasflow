# Iteration 45 — 自主影视 Agent（记忆 · Skills · MCP · 子 Agent · 自动化）

## 1) 本轮目标

对标 Nous Hermes Agent 的核心形态，在 **不独立部署** 前提下落地：工程记忆、用户 Skills、Canvas MCP 桥、并行子 Agent、工程内定时自动化。

## 2) 变更范围

- `src/lib/hermes/agent/*` — 记忆 / Skills / MCP / 子 Agent / 自动化 / 上下文组装
- `HermesSidebar` + `hermesPlanLlm` + `runHermesTool` — 注入与执行
- `docs/product/HERMES_AUTONOMOUS_AGENT.md` — 架构真源

## 3) 功能清单

1. **记忆**：`.canvasflow/hermes/memory.json`，「记住」双写；对话注入
2. **Skills**：扫描 `skills/*.md`；对话点名加载正文
3. **Canvas MCP**：工具表 + `invokeHermesCanvasMcpTool`
4. **子 Agent**：`agent.delegate_parallel`；「并行出图」规则计划
5. **自动化**：`automations.json` + `useHermesAutomationRunner`

## 4) 非目标

- 外接 Nous 安装包 / Telegram Gateway
- 真 MCP stdio Server
- App 关闭后仍执行 cron

## 5) 验收

1. 「记住：女主服装偏冷色」→ 「我的记忆」可见
2. 在 `skills/test.md` 写 Skill → 「有哪些 skills」列出
3. 「并行出 1-3 镜图」→ 多路 ▶ 进度
4. 「每 30 分钟流程检查」→ 创建后等待或改 interval 测 tick
5. `npm run test -- src/lib/hermes/agent/hermesAgent.test.ts`

## 6) DoD

- [x] 单测
- [ ] 手工 1～4
