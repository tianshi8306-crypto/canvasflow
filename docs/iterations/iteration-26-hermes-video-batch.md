# 迭代 26 — Hermes 批量出视频（Director）

**层**：ProductionFlowLayer  
**核心目标**：用户可在 Hermes 用自然语言触发与脚本工作台一致的**批量视频生成**，执行前做就绪检查，缺节点时自动建链。

## 模块

1. `src/lib/hermes/hermesTools/videoGenerateTool.ts` — `assessBatchVideoReadiness` + `batchGenerateVideosForStoryboard`
2. `src/lib/hermes/hermesPlanFromIntent.ts` — `wantsVideo`、全流程含出视频步骤
3. `src/lib/hermes/hermesTools/runHermesTool.ts` — 注册 `video.generate_for_beats`

## 功能点

1. 话术「帮第 1、2 镜出视频」→ 计划含 `video.generate_for_beats`
2. 执行前预检：分镜文案、分镜图、视频节点、视频 draft prompt
3. 缺视频节点时先 `handleScriptNodeCompleted` 再提交
4. 「全流程」计划：大纲/分镜/出图/出视频（导出仍另说）

## 非目标

- 侧栏任务轨（iteration 27）
- 视频 job 轮询 UI 聚合
- 自动把 `videoMotionPrompt` 从分镜表同步（沿用建链时 visualPrompt）

## 手工验收

1. 工程内 script + 分镜就绪 + 关键帧已出 + 已建链 → Hermes「批量出视频」→ 执行 → 视频节点 `activeJob` 提交
2. 无视频节点 → 执行计划仍成功，工具内先建链
3. 缺分镜图 → 失败提示「缺少分镜图」
4. 说「全流程」→ 计划含出图 + 出视频（步骤较多，可只确认结构）

## 回滚

- 移除 `video.generate_for_beats` 分支与 `wantsVideo` 规则
