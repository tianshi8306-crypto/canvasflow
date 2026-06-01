# iter-108 · Hermes 画布高亮反馈 ✅

**层级**：CanvasExperienceLayer  
**前置**：iter-107 Orb 进度共感  
**状态**：已实现

## 1) 本轮目标

Agent 执行步骤前，画布目标节点 **短暂 cyan 高亮**；用户改选中时侧栏一行确认（非 situation 全文）。

## 2) 变更范围

- `hermesCanvasHighlight.ts`、`hermesCanvasHighlightStore.ts`
- `useEdgeViewModel` / `buildNodesView`、`FlowCanvas`
- `HermesSidebar`（onStepStart 脉冲 + selection ack）
- `focusCanvasShotTool.ts`、`runHermesTool.ts`（add_text）
- `hermes-shell.css`（`.flowNodeHermesPulse`）

## 3) 功能清单

1. Director 步 `onStepStart` → 按 beat/镜号解析节点 id → 3s 高亮（reduced-motion 1.2s）。
2. `canvas.focus` / `canvas.add_text_node` 完成后同步脉冲。
3. 用户选中变化 → composer 状态行「已注意到选中：…」（4s 自动消失）。
4. Agent 高亮用 cyan 描边，与 ReactFlow 选中框、@钉选条视觉区分。

## 4) 非目标

- Octo 圈选改图
- 脚本表 beat 行内高亮（仅节点级）
- iter-109 ContextStrip → [`iteration-109-hermes-context-strip.md`](./iteration-109-hermes-context-strip.md)

## 5) 验收

1. 「定位第 2 镜」→ 对应 video/image 节点 cyan 圈 3s。
2. 「添加文本节点」→ 新节点高亮。
3. 手动选中节点 → 浮窗 composer 上方一行 ack，无长 situation。
4. `npm run test -- hermesCanvasHighlight`

## 6) UI/UX

- 高亮不阻塞拖拽；`prefers-reduced-motion` 缩短动画。
- ack 文案灰色 secondary，与 cyan 执行态区分。

## 7) 回退

移除 store + `flowNodeHermesPulse` class；Sidebar 去掉 onStepStart 脉冲。
