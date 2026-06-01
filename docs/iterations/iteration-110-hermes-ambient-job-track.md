# iter-110 · Hermes Ambient 任务轨 ✅

**层级**：CanvasExperienceLayer  
**前置**：Phase 0 浮窗轻壳验收、iter-105  
**状态**：已实现（Orb/浮窗顶栏 chip、任务抽屉、终态 toast、float 无 inline JobCenter）

## 1) 本轮目标

任务从浮窗聊天区 **inline 控制台** 改为 **ambient 摘要 + 抽屉**；终态用 toast，不污染聊天。

## 2) 变更范围

- `hermesJobAmbient.ts`、`hermesJobToastStore.ts`、`useHermesJobAmbientSnapshot.ts`
- `HermesJobAmbientChip`、`HermesJobDrawer`、`HermesJobToastHost`、`HermesJobAmbientBridge`
- `HermesFloatPanel`、`HermesOrb`、`HermesSidebar`、`HermesJobCenter`、`canvasUiStore`

## 3) 功能清单

1. **Orb + 浮窗顶栏**：有活跃 Job 时显示 ambient chip（进行中/排队/失败摘要），点击打开任务抽屉。
2. **任务抽屉**：画布右下角 overlay，内含完整 `HermesJobCenter`（`variant="drawer"`）；Esc / 遮罩关闭。
3. **浮窗去 inline Job**：float 模式不再在聊天与 composer 之间插入 Job 块，聊天区占比提升。
4. **终态 toast**：Job done/failed/cancelled 与入队提示走右上角 toast，不再写入聊天 assistant 消息。

## 4) 非目标

- Orb hover 双行待办预览（iter-107）
- planning 期间 execute 排队（iter-112）
- 步内 `▶/✓` 进度仍保留在聊天（后续可迁 drawer）

## 5) 验收步骤

1. 打开工程 → 对 H 下制片指令（如分镜出图）→ 浮窗顶栏或 Orb 旁出现任务 chip。
2. 点击 chip → 右下角抽屉展开，可见 Job 列表与取消。
3. 浮窗聊天区无 inline「任务」peek 条，消息区明显更高。
4. Job 完成/失败 → 右上角 toast，聊天无「执行完成」长系统句。
5. `npm run test -- hermesJobAmbient hermesPhase0Acceptance hermesJobCenter`

## 6) UI/UX

- **关键界面**：画布 Orb 旁 pill、浮窗顶栏 chip、右下角任务抽屉、右上角 toast。
- **关键状态**：无任务时 chip 隐藏；失败 chip 红色强调；抽屉空态文案。
- **键盘**：抽屉 Esc 关闭；chip 可聚焦。
- **本轮 UI 非目标**：不改 `--cf-*` token；不做 Octo 分屏。

## 7) 风险与回退

- **风险**：Orb 旁 chip 与 suggest 气泡重叠。
- **触发**：chip 挡画布操作或 drawer 无法关闭。
- **回退**：恢复 `HermesJobCenter compact={isFloat}` inline；移除 drawer/toast 桥。

## 8) DoD

- 功能 1～4 手工通过
- 相关 vitest 通过
- Phase 0 布局测试更新（无 inline job peek）
