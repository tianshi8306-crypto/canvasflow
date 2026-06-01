# Iteration 42-1 — 失败后自动修复（对话反馈）

- **层**：ProductionFlowLayer
- **前置**：iter-41
- **目标**：计划任一步在重试后仍失败时，自动生成**一轮**修复子计划并执行；进度仅在对话中展示。

## 交付

1. `proposeFailureRecoveryPlan`：按失败 `toolId` + 错误信息生成 ≤2 步修复计划（`plannerSource: recovery`）。
2. `executeDirectorPlan` 返回 `failedStep`。
3. `HermesSidebar`：主计划失败后自动跑修复计划一次（`isRecovery` 不再链式修复）。

## 修复策略（规则）

| 失败步骤 | 修复 |
|----------|------|
| 批量出图 | 重试批量出图 |
| 批量出视频 | 优先 `video.retry_failed` |
| 重试视频仍失败 | 流程检查 + 状态摘要 |
| 建链 | 重新建链 |
| 分镜/大纲 | 重试对应脚本步骤 |
| 导出 | 流程检查 + 重试导出 |
| 其他 | 流程检查 + 摘要 |

## 验收

1. 模拟批量视频失败后 → 对话出现修复说明并自动执行 `重试失败镜头` 或等价步骤。
2. 修复计划失败 → 提示用户用自然语言继续，无计划卡。
3. `npm run typecheck` + `hermesFailureRecovery.test.ts` 通过。

## 非目标

- 无限链式修复、LLM 生成修复计划（iter-42+）

## 回滚

移除 `hermesFailureRecovery.ts` 与 Sidebar 中 `allowRecovery` 分支。

---

**下一项（42-2）**：对话引用参考素材（无上传条 UI）。  
**再下一项（42-3）**：设置页模板区只读/隐藏，完全对话化。
