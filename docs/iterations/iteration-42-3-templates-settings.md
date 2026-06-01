# Iteration 42-3 — 设置页计划模板只读（对话管理）✅

- **层**：ProductionFlowLayer
- **前置**：iter-42-2
- **目标**：设置页不再提供模板删除/编辑主路径；模板在 H 对话中管理，设置区只读查阅。

## 交付

1. `SettingsHermesPlanTemplates`：移除删除/复制 ID 按钮；展示对话示例与可折叠目录。
2. 设置 → Hermes：合并说明与模板只读区为一节。
3. 对话保存/删除模板时 `notifyHermesTemplatesUpdated()`，设置页打开时列表自动刷新。
4. 浮窗预制句补充模板话术。

## 验收

1. 设置 → Hermes → 计划模板：无删除按钮，有「请在 H 对话管理」说明。
2. H 里说「保存模板为「测试」」→ 再打开设置可见自定义模板。
3. `npm run typecheck` 通过。

## 回滚

恢复 `SettingsHermesPlanTemplates` 删除按钮与旧文案。
