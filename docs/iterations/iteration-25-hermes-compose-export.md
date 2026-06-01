# 迭代 25 — Hermes 成片导出（Phase E 最小集）

**层**：ProductionFlowLayer  
**核心目标**：用户可在 Hermes 侧栏用自然语言触发与脚本工作台相同的**合成导出**（时间线 + 可选 FFmpeg 渲染），无需 @ 画布节点。

## 功能点

1. Director 工具 `compose.export_script`：复用 `projectStore.exportScriptCompose`
2. 意图识别：`导出成片`、`合成导出`、`先准备时间线不导出` 等
3. 执行前 `assessComposeExportScope` 校验（缺视频/未出片时明确失败）
4. 支持镜号范围（`第 1、2 镜`）与 `autoRender: false`（仅填时间线）

## 模块

- `src/lib/hermes/hermesTools/composeExportTool.ts`
- `hermesPlanFromIntent.ts`（已有 export 步骤）
- `runHermesTool.ts` 注册工具

## 非目标

- Hermes 后台任务总进度条
- 自动等待全部视频生成完成后再导出（需用户确认各镜已出片）
- 修改 FFmpeg 参数 UI

## 手工验收

1. 工程内脚本 + 至少一镜已出片视频 → Hermes「帮我把脚本导出成片」→ 计划 → 执行 → 状态栏显示 `assets/exports/final.mp4`
2. 「先准备合成时间线，不导出」→ 创建/更新 ffmpegConcat，不调用 render
3. 无视频镜 → 执行失败并提示缺素材

## 回滚

- 移除 `compose.export_script` 分支；计划规则可保留不触发
