# iter-93 · Hermes `image.retry_failed`

## 目标

对话/计划可重试 `storyboardShots.status === failed` 的关键帧出图，对齐 iter-92 UI 与 `video.retry_failed`。

## 范围

- `imageRetryTool.ts`、`runHermesTool.ts`
- 规则规划、推理补步、制片 issue、失败恢复、计划模板

## 非目标

- 无图片节点时自动建链（仍走 `image.generate_for_beats` / 分镜区批量出关键帧）

## 验收

1. 「帮我把失败镜头的关键帧重新出图」→ 计划含 `image.retry_failed`  
2. `npm run test -- hermesDirector hermesFailureRecovery hermesPlanTemplates hermesToolRegistry`

## 回退

移除 toolId 与各注册/规则分支。
