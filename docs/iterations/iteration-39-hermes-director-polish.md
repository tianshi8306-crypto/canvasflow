# Iteration 39 — Hermes 导演收尾（设置 / 任务轨 / 导演模式）

- **层**：ProductionFlowLayer
- **目标**：补齐 iter-38 未做项：设置页模板目录、导演模式、任务轨与批量 Agent 联动、文档。

## 交付

1. **导演模式**（`hermesDirectorPrefs.directorMode`）：计划生成后立即执行全部步骤。
2. **设置 → Hermes 计划模板**：内置 + 自定义列表、复制 ID、删除自定义。
3. **任务轨**：批量出图/视频步显示镜号进度；Agent 任务标签含镜号。
4. **文档**：`HERMES.md` 工具表与偏好说明；`CURRENT_PROGRESS.md` 更新。

## 验收

1. 开启导演模式 → 说「跑模板 分镜出关键帧」→ 无待确认卡片、自动执行。
2. 设置页可见 5 个内置模板；侧栏存为模板后出现在自定义区并可删除。
3. 执行含批量出图计划时，任务区显示「批量出图（2/5 · 镜 3）」及单镜 Agent 行。

## 回滚

关闭导演模式；删除 `canvasflow.hermesDirector.v1` 中 `directorMode` 字段即可。
