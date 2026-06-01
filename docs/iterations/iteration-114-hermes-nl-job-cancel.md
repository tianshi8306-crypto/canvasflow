# iter-114 · 自然语言 Job 取消 ✅

**层级**：ProductionFlowLayer  
**前置**：iter-113 规划期排队、iter-72/85 Job 取消与队列

## 1) 本轮目标

用户说「取消第 2 镜出图」→ 无需打开 Job 面板，即可取消匹配的制片 Job / 规划后队列项。

## 2) 变更范围

- `hermesNlJobCancel.ts`（解析 + 匹配 + 执行）
- `hermesAgentChat.ts`（`cancel_jobs_nl` 意图）
- `hermesPlanningMessageQueue.ts`（按条件移除）
- `hermesJobOrchestration.ts`（队列提示文案）

## 3) 功能清单

1. **按镜号 + 媒体类型**：「取消第 2 镜出图 / 出视频」→ 取消 queued/running 的 `director_plan`（步骤 args 或原文镜号匹配）。
2. **批量媒体**：「只取消视频 / 取消全部出图」→ 取消对应工具类的 Job。
3. **规划队列**：「取消规划队列」清空；按镜号取消时同步移除 iter-113 规划后队列项。
4. **保留 iter-85**：「取消全部排队」仍走 `cancel_queued_jobs`。

## 4) 非目标

- 镜级 node-agent / Seedance 后台任务取消（仍走节点侧）
- 跨工程 Job
- LLM 兜底解析（本轮纯规则）

## 5) 验收

1. 队列中有「第 2 镜出图」Job → 说「取消第 2 镜出图」→ 聊天 ack + Job 变已取消。
2. 规划中又排队「帮第 2 镜出图」→ 说「取消第 2 镜出图」→ 规划队列项移除 + composer status 更新。
3. 「只取消视频」→ 仅含 `video.*` 步骤的 Job 被取消。
4. 「取消规划队列」→ 规划后队列清空。
5. `npm run test -- hermesNlJobCancel hermesAgentChat hermesPhase0Acceptance`

## 6) UI/UX

- 取消结果走现有 assistant 气泡，无新面板。
- Job / Orb 状态由既有 store 订阅自动同步。

## 7) 回退

移除 `hermesNlJobCancel` 与 `cancel_jobs_nl` 分支；恢复队列提示旧文案。
