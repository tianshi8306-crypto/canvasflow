# Iteration 71 — M1 制片任务中心（Job 中心）

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §3.6 M1 · P0  
> 基础：iter-47 Job 队列 + HermesTaskTrack

## 1) 目标

复杂制片指令分解为可展开子任务列表，侧栏集中展示排队/进行中/失败与步骤 ▶✓✗，替代仅对话气泡进度。

## 2) 范围（3 模块）

- `hermesJobStore` — Job 级 `stepStatuses`、执行中 patch
- `HermesJobCenter` + `hermesJobCenterModel` — 分组 UI、取消排队
- `HermesSidebar` — 步骤回调同步 Job；替换 `HermesTaskTrack`

## 3) 功能

1. **制片任务**列表：按 进行中 → 排队 → 失败 → 完成 排序
2. 展开查看计划内各步状态（○ ▶ ✓ ✗）
3. 进度条 `done/total` 步
4. 排队任务 **取消**
5. **后台**区：镜级出图/出视频等 agent 任务（不含已并入 Job 的 director/planjob 行）

## 4) 非目标

- 取消正在执行的 Job
- 跨工程 Job 面板 / 持久化 Job 历史
- 对话区移除 ▶✓✗ 进度行（仍保留，与中心并存）

## 5) 验收

1. 执行多步计划 → Job 中心展开可见各步状态实时更新
2. 执行中再发制片指令 → 第二条显示「排队」，可取消
3. 批量出图时「后台」出现镜级任务，点击可定位节点
4. `npm run test -- hermesJobCenter` 通过

## 6) 状态

✅ 已实现（iter-71 / M1）
