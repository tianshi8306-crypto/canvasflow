# 迭代 34 — Hermes 影视流程检查与批量参数（阶段 2 起步）

**层**：ProductionFlowLayer + ProviderOrchestrationLayer  
**前置**：[`iteration-33-hermes-film-knowledge-phase1.md`](iteration-33-hermes-film-knowledge-phase1.md) ✅

---

## 1) 目标

在阶段 1「知识 + 搭流程 + 写 prompt」之上，补齐 **SOP 流程诊断** 与 **批量视频参数**，让 Hermes 能回答「还缺什么」并一键改 Seedance 输出规格。

---

## 2) 交付

| 项 | 路径 |
|----|------|
| `film.workflow_check` | `filmWorkflowCheck.ts` + `runHermesTool` |
| `film.batch_set_video_params` | `filmBatchSetVideoParams.ts` |
| 技能芯片 prefill | `hermesSkills.ts` + `HermesSidebar` |
| 排障知识 | `docs/hermes-knowledge/troubleshoot/seedance-common.md` |
| 测试 | `filmWorkflowCheck.test.ts`、`filmWorkflowTopology.test.ts` |

---

## 3) 验收

1. Hermes 输入「检查流程还缺什么」→ 执行计划含 `film.workflow_check` → 返回分阶段 ✓/△/○ 列表。  
2. 已有 videoNode 时说「全部改成 5 秒竖屏」→ `film.batch_set_video_params` 写入 durationSec + aspectRatio。  
3. 点击技能「搭短剧流程 / 流程检查 / 视频提示词」→ 输入框预填对应话术。

---

## 4) 非目标

- Brain 每条消息默认 RAG  
- embedding 混合检索  
- 独立知识库浏览器 UI
