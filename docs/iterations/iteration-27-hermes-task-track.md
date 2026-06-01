# 迭代 27 — Hermes 任务轨（后台进度）

**层**：CanvasExperienceLayer  
**核心目标**：侧栏展示 Hermes / 节点 Agent **并行任务**进度；灵体在任务进行中或失败时显示角标。

## 模块

1. `src/lib/hermes/hermesTaskTrack.ts` — 任务合并/裁剪逻辑  
2. `src/store/hermesTaskStore.ts` + `initHermesTaskTrack.ts` — 订阅 `node-agent-event`  
3. `src/components/hermes/HermesTaskTrack.tsx` + `HermesSidebar` / `HermesOrb`

## 功能点

1. 图片/视频/分镜 Agent 事件 → 任务行（按 nodeId 合并，阶段进度条）  
2. Director 执行计划每步 → 「计」类任务行（排队/进行中/完成/失败）  
3. 流式对话 → 短暂显示「Hermes 对话」任务  
4. 点击节点任务 → 选中并 fit 画布节点；灵体角标（进行中/失败）

## 非目标

- 取消任务 / 视频异步轮询细粒度进度  
- 任务持久化进工程文件  
- 顶栏全局任务中心

## 手工验收

1. 执行「批量出图」计划 → 侧栏任务轨出现多行「进行中」，完成后变「完成」  
2. 收起侧栏 → 灵体绿点；故意失败一步 → 红点  
3. 点击某图片任务行 → 画布聚焦对应节点  
4. 切换工程 → 任务列表清空

## 回滚

- 移除 `initHermesTaskTrack` 与 `HermesTaskTrack` 组件
