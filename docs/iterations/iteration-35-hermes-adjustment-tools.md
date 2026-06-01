# Iteration 35 — Hermes 调整阶段工具（patch / focus / bible）

- **层**：ProductionFlowLayer
- **目标**：补齐「调整优化」阶段 Director 工具，支持单镜改词再出图/视频、画布定位、项目圣经更新。

## 模块

| 模块 | 变更 |
|------|------|
| `hermesTools/patchStoryboardShotTool.ts` | `storyboard.patch_shot` |
| `hermesTools/focusCanvasShotTool.ts` | `canvas.focus` |
| `hermesTools/bibleUpdateTool.ts` | `bible.update` |
| `hermesPlanFromIntent.ts` | 规则计划触发 |
| `hermes_agent.rs` | LLM 规划器工具列表 |

## 功能

1. **patch_shot**：改 `visualPrompt` / `videoMotionPrompt`，可选 `regenerateImage` / `regenerateVideo`
2. **canvas.focus**：选中并 fit 镜号对应 image/video 节点；无节点时打开脚本全屏聚焦
3. **bible.update**：写梗概/风格/禁忌/时长；可选 `syncCharacters`

## 不在范围

- `template.run`、`canvas.summarize` 真实实现

## 后续（iter-36）

- 设置 → Hermes 导演：**低风险步骤自动执行**（`hermesDirectorPrefs.autoRunLowRisk`）

## 验收

1. 打开工程 + 脚本节点，说「第 1 镜改成雨夜再出图」→ 计划含 `storyboard.patch_shot`，执行后分镜文案更新并提交出图
2. 说「定位第 2 镜」→ `canvas.focus`，画布缩放到对应节点或脚本表
3. 说「视觉风格改成古风」→ `bible.update`，侧栏圣经字段更新并持久化

## 回滚

移除三工具 id 与 `runHermesTool` 分支即可；无 schema 迁移。
