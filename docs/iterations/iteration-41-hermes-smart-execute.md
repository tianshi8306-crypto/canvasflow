# Iteration 41 — Hermes 智能执行（规划 / 确认 / 重试 / 模板对话）

- **层**：ProductionFlowLayer
- **前置**：[`iteration-40-hermes-conversation-only.md`](iteration-40-hermes-conversation-only.md)
- **目标**：在「只对话、只审画布」前提下，提高执行可靠性与人话覆盖率。

## 交付

1. **规划**：规则弱匹配或含制片意图时走 LLM；「仅聊/别执行」不生成计划；弱规则（仅列模板/请先打开工程）不挡 LLM。
2. **大批量确认**：≥4 镜批量出图/视频前，对话回复「继续/确认」再执行（无计划卡 UI）。
3. **失败重试**：`image.generate_for_beats` / `video.generate_for_beats` / `video.retry_failed` 失败自动重试 1 次。
4. **模板对话**：「有哪些模板」「保存模板为…」「删除模板…」纯对话处理；最近计划可存为自定义模板。

## 变更模块

- `hermesDirector.ts` · `HermesSidebar.tsx`
- 新：`hermesBatchConfirm.ts` · `hermesPendingBatch.ts` · `hermesTemplateChat.ts` · `hermesConversationIntent.ts` · `hermesLastPlan.ts`

## 验收

1. 模糊指令「帮我把分镜都出了」→ 尽量出计划并自动执行（或 LLM 计划）。
2. 8 镜批量出视频 → 先出现确认话术；回复「继续」才执行。
3. 模拟某步失败 → 对话出现「2 秒后重试」再试一次。
4. 「有哪些模板」→ 列表在对话中，无计划卡。
5. 跑完一轮后「保存模板为「我的流程」」→ 再说「跑模板 我的流程」可套用。

## 非目标

- 任务轨 UI、参考素材条
- 多轮自动修复链（iter-42）
- 设置页移除模板列表（仍保留，对话优先）

## 回滚

删除新模块引用；`proposeDirectorPlanAsync` 恢复规则优先且 LLM 仅 rule=null；`HermesSidebar` 去掉 batch/template 分支。
