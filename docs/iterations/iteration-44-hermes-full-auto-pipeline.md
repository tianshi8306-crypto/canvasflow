# Iteration 44 — Hermes 全自动跑片

## 1) 本轮目标（一句话）

用户一句「全自动跑片」即可从梗概跑到 **导出 mp4**，大批量免确认，失败可 **断点续跑**。

## 2) 变更范围

- **ProductionFlowLayer**：模板 `full-auto-export`、`hermesPlanFromIntent`、断点 `hermesPipelineCheckpoint`
- **ProviderOrchestrationLayer**：`hermesBatchConfirm` 免确认策略、`HermesSidebar` 执行与续跑
- **AssetAndQualityLayer**：`hermesAutoPipelinePrefs`、对话指令 `hermesAutoPipelineChat`

## 3) 功能清单

1. **模板 `full-auto-export`**：梗概 → 大纲 → 分镜 → 建链 → 出图 → 视频词 → 出视频 → 流程检查 → 导出
2. **意图**：「全自动 / 一键出片 / 全流程 / 端到端」等命中该模板
3. **免批量确认**：全自动模板 + 默认偏好 `skipBatchConfirm`（可说「关闭全自动」恢复确认）
4. **断点续跑**：每步成功写入 `localStorage`；「继续跑片」从下一步执行

## 4) 非目标

- 并行任务台、子 Agent
- 无人值守跨工程调度
- 保证 API 额度内一定出片成功

## 5) 验收步骤

1. 打开工程，说「全自动跑片：咖啡店清晨，女主点单」→ 列出约 10 步并自动执行，无 ≥4 镜「继续」确认
2. 执行中故意断网或取消一步 → 说「继续跑片」→ 从失败前进度后续跑
3. 说「关闭全自动」后再「分镜出图」且 ≥4 镜 → 应出现「继续」确认
4. `npm run test -- src/lib/hermes/hermesAutoPipeline.test.ts`

## 6) UI/UX

- 全自动计划气泡附带说明；浮窗 intro 更新
- 进度仍为 `▶ / ✓ / ✗` 行

## 7) 风险与回退

- **风险**：长计划中途失败、API 费用
- **回退**：删除 `full-auto-export` 模板与 checkpoint 逻辑

## 8) DoD

- [x] 单测
- [ ] 手工 1～3（需 Tauri + 已配置模型/Key）
