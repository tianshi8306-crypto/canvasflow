# iter-113 · 规划期排队 ✅

**层级**：ProductionFlowLayer  
**前置**：iter-112 Composer 上传、Job 队列（iter-85/110）

## 1) 本轮目标

`planning` 期间用户再发 **execute/mixed** 指令 → **入规划后队列**，composer 可见「规划完成后将执行…」，不再 silent reject。

## 2) 变更范围

- `hermesPlanningMessageQueue.ts`
- `hermesParallelChannel.ts`（canSubmit 策略）
- `HermesSidebar.tsx`（入队 / flush / status）

## 3) 功能清单

1. **入队**：planning + 制片通道 → session 队列（FIFO，最多 3 条，同文去重）。
2. **flush**：当前轮 `setPlanning(false)` 后自动 dequeue 并 `submitUserMessage` 下一条。
3. **composer status**：`正在规划… · 规划完成后将执行：…`。
4. **consult 不变**：规划期间仍可咨询对话。

## 4) 非目标

- 双 plan LLM 并行
- 跨工程队列
- NL 取消队列（→ iter-114）

## 5) 验收

1. 发复杂 execute → 规划中出现「正在规划…」→ 再发一条 execute → 聊天 ack + status 显示队列。
2. 第一条规划结束 → 第二条自动开始规划（无需重打）。
3. 规划期间发 consult → 正常回复。
4. 同指令重复发送 → 提示已在队列，不重复入队。
5. `npm run test -- hermesPlanningMessageQueue hermesParallelChannel hermesPhase0`

## 6) UI/UX

- 队列提示走现有 `hermesFloatComposerStatus`，不新增面板。
- 队列满时 status 栏 toast 式 `setStatusText`。

## 7) 回退

恢复 `canSubmit` planning 硬拒；移除 queue 模块与 Sidebar 分支。
