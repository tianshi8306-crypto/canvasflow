# Iteration 38 — Hermes 计划模板（template.run）

- **层**：ProductionFlowLayer
- **目标**：内置可复用 Director 计划模板；支持保存当前计划为自定义模板。

## 内置模板

| id | 名称 |
|----|------|
| `creative-pipeline` | 创意到成片 |
| `storyboard-keyframes` | 分镜出关键帧 |
| `keyframes-to-video` | 关键帧到视频 |
| `finish-export` | 检查并导出成片 |
| `retry-failed-video` | 重试失败视频 |

## 用法

- 「跑模板 分镜出关键帧」「用模板 creative-pipeline」
- 「有哪些计划模板」→ 列出目录
- 计划卡片 **存为模板** → `localStorage` 自定义模板

## 技术

- `hermesPlanTemplates.ts`：`instantiateTemplatePlan`、`expandTemplateStepsInPlan`
- `template.run` 仅在规划阶段展开，执行器不单独跑该 toolId

## 验收

1. 有脚本时说「跑模板 分镜出关键帧」→ 计划含分镜/建链/出图步骤
2. 点「存为模板」后，再说「跑模板 user-xxx」可命中（若 id 在话术中出现）
3. LLM 规划含 `template.run` 时，提交前自动展开
