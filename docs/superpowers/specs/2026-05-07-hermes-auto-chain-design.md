# Hermes 自动串联设计（修订版）

> 日期：2026-05-07
> 状态：修订中
> 修订说明：基于实际代码实现（而非设计文档假设）重写

## 1. 概述

Hermes 自动串联是 CanvasFlow AI Studio 的智能节点编排机制。当 `scriptNode` 完成脚本解析和分镜生成后，自动为每个 `storyboardShots` 创建 `imageNode` + `videoNode` 配对节点组，减少用户的手动操作。

## 2. 核心流程

```
scriptNode 完成（storyboardShots 已填充）
     ↓
遍历 storyboardShots，为每个 shot 创建：
[imageNode（提示词=shot.visualPrompt）] → [videoNode（提示词=shot.visualPrompt）]
     ↑ 引用该镜头的 scriptBeatId 绑定
```

**关键**：不存在独立的 `StoryboardNode`。Storyboard 数据（`storyboardShots[]`）直接存储在 `scriptNode.data` 中。

## 3. 设计决策

| 决策项 | 选择 | 说明 |
|--------|------|------|
| 触发机制 | 全自动 | scriptNode phase=end 且有 storyboardShots 时触发 |
| 节点类型 | 复用现有 | `imageNode`（ImageAssetNode）、`videoNode`（VideoAssetNode） |
| Shot 节点 | 成对 | 每个 shot 创建 imageNode + videoNode |
| 连接关系 | scriptNode → imageNode → videoNode | 三节点串行连线 |
| 布局方式 | 水平排列 | imageNode 在左，videoNode 在右；垂直顺序按 shot 索引 |
| 状态反馈 | 静默执行 | 后台运行，完成后状态栏显示汇总 |
| 错误处理 | 继续下一个 | 单个 shot 失败不影响其他，汇总报告 |

## 4. 触发条件

**必须同时满足**：
1. `event.phase === "end"`
2. `event.agentName === "脚本调度 Agent"`（scriptNode 专用 agent）
3. 目标 `scriptNode.data.storyboardShots.length > 0`

```typescript
window.addEventListener("node-agent-event", (evt: CustomEvent<NodeAgentRuntimeEvent>) => {
  const { nodeId, agentName, phase } = evt.detail;
  if (phase !== "end") return;
  if (agentName !== "脚本调度 Agent") return;

  const scriptNode = useProjectStore.getState().nodes.find(
    (n) => n.id === nodeId && n.type === "scriptNode"
  );
  if (!scriptNode) return;

  const shots = scriptNode.data.storyboardShots ?? [];
  if (shots.length === 0) return;

  // 开始自动串联
  shots.forEach((shot, idx) => { /* ... */ });
});
```

## 5. 文件结构

```
src/lib/hermes/
├── autoChain.ts           # 核心逻辑：事件监听 + 遍历 shots 创建节点
├── types.ts              # Hermes 相关类型定义
└── shotNodeFactory.ts    # Shot 节点组成对创建工具函数
```

## 6. 模块职责

### 6.1 types.ts

```typescript
export type HermesShotNodeGroup = {
  imageGenNodeId: string;
  videoShotNodeId: string;
  scriptBeatId: string;
  shotIndex: number;
};

export type HermesAutoChainResult = {
  total: number;
  succeeded: number;
  failed: number;
  groups: HermesShotNodeGroup[];
};
```

### 6.2 shotNodeFactory.ts

根据单个 `StoryboardShot` 创建 `imageNode` + `videoNode` 配对。

```typescript
import { newNodeDataByType } from "@/lib/canvasNodeDefaults";
import type { StoryboardShot, ScriptBeat } from "@/lib/types";
import type { HermesShotNodeGroup } from "./types";
import { defaultVideoNodePersisted, defaultVideoGenerationDraft } from "@/lib/videoNodeTypes";

export function createShotNodePair(
  shot: StoryboardShot,
  beat: ScriptBeat | undefined,
  basePosition: { x: number; y: number },
): HermesShotNodeGroup {
  const imageNodeId = crypto.randomUUID();
  const videoNodeId = crypto.randomUUID();
  const prompt = shot.visualPrompt?.trim() || beat?.description?.trim() || "";

  // imageNode
  const imageNodeData = {
    ...newNodeDataByType.imageNode(),
    label: beat?.shotNumber ? `镜${beat.shotNumber}` : "图片",
    prompt,
    params: {
      scriptBeatId: shot.scriptBeatId,
      shotNumber: beat?.shotNumber,
    },
  };

  // videoNode
  const videoNodeData = {
    ...newNodeDataByType.videoNode(),
    label: beat?.shotNumber ? `视频-${beat.shotNumber}` : "视频",
    params: {
      scriptBeatId: shot.scriptBeatId,
      shotNumber: beat?.shotNumber,
    },
    video: {
      ...defaultVideoNodePersisted(),
      draft: {
        ...defaultVideoGenerationDraft(),
        workflow: "text_to_video",
        prompt,
      },
    },
  };

  // 返回节点数据（由调用方通过 useProjectStore.addNode 写入 store）
  return {
    imageGenNodeId: imageNodeId,
    videoShotNodeId: videoNodeId,
    scriptBeatId: shot.scriptBeatId,
    shotIndex: 0, // 由调用方填入 index
    // 节点数据通过 out 参数返回
  };
}
```

### 6.3 autoChain.ts

协调模块：

```typescript
export function handleScriptNodeCompleted(scriptNodeId: string): HermesAutoChainResult {
  const state = useProjectStore.getState();
  const scriptNode = state.nodes.find((n) => n.id === scriptNodeId && n.type === "scriptNode");
  if (!scriptNode) return { total: 0, succeeded: 0, failed: 0, groups: [] };

  const shots = scriptNode.data.storyboardShots ?? [];
  const beats = scriptNode.data.scriptBeats ?? [];
  const results: HermesShotNodeGroup[] = [];
  let succeeded = 0;
  let failed = 0;

  // 起始位置：scriptNode 右下角偏移
  const baseX = scriptNode.position.x + 500;
  const baseY = scriptNode.position.y;

  shots.forEach((shot, idx) => {
    try {
      const beat = beats.find((b) => b.id === shot.scriptBeatId);
      const { imageGenNodeId, videoShotNodeId } = createShotNodePair(
        shot,
        beat,
        { x: baseX + idx * 450, y: baseY + idx * 160 },
      );

      // 写入 store
      useProjectStore.getState().addNode(imageNode);
      useProjectStore.getState().addNode(videoNode);

      // 建立连线：scriptNode → imageNode → videoNode
      useProjectStore.getState().onConnect({
        source: scriptNodeId,
        target: imageGenNodeId,
        sourceHandle: "out",
        targetHandle: "in",
      });
      useProjectStore.getState().onConnect({
        source: imageGenNodeId,
        target: videoShotNodeId,
        sourceHandle: "out",
        targetHandle: "in",
      });

      results.push({ imageGenNodeId, videoShotNodeId, scriptBeatId: shot.scriptBeatId, shotIndex: idx });
      succeeded++;
    } catch {
      failed++;
    }
  });

  return { total: shots.length, succeeded, failed, groups: results };
}
```

## 7. 布局规则

```
scriptNode.position=(sx, sy)

Shot #0: (sx+500, sy+0)      [imageNode] ──→ [videoNode] (sx+900, sy+0)
Shot #1: (sx+500, sy+160)    [imageNode] ──→ [videoNode] (sx+900, sy+160)
Shot #2: (sx+500, sy+320)    [imageNode] ──→ [videoNode] (sx+900, sy+320)
```

- 水平间距（imageNode → videoNode）：400px
- 垂直间距（相邻 shot）：160px
- 起始 X = scriptNode.position.x + 500
- 起始 Y = scriptNode.position.y + idx * 160

## 8. 连接规则

| 源 | 目标 | 类型 | 说明 |
|----|------|------|------|
| scriptNode | imageNode | script→image | 提供 shot.visualPrompt 作为 imageNode prompt |
| imageNode | videoNode | image→video | imageNode 生成的图片作为 videoNode 参考 |

## 9. 错误处理策略

### 9.1 单个 Shot 失败

- 记录到 `useProjectStore.getState().setStatusText`
- 继续处理下一个 Shot
- 失败节点仍写入 store（状态为 failed，用户可手动重试）

### 9.2 汇总报告

```
"Shot 节点创建完成：3 个成功，1 个失败"
```

### 9.3 失败节点重试

用户可点击失败节点手动重新触发，不影响其他节点。

## 10. 依赖项

- `src/lib/nodeAgentRuntime/runNodeTaskAgent.ts` — `node-agent-event` 事件发射点
- `src/lib/nodeAgentRuntime/types.ts` — `NodeAgentRuntimeEvent` 类型
- `src/lib/canvasNodeDefaults.ts` — `newNodeDataByType` 工厂函数
- `src/lib/videoNodeTypes.ts` — `defaultVideoNodePersisted` / `defaultVideoGenerationDraft`
- `src/store/projectStore.ts` — `addNode`、`onConnect`、`setStatusText`
- `src/lib/types.ts` — `StoryboardShot`、`ScriptBeat` 类型

## 11. 不存在的设计元素（说明）

以下在原文档中出现但实际不存在的概念：

| 原文档描述 | 实际情况 |
|-----------|---------|
| `StoryboardNode` | 不存在。Storyboard 数据在 `scriptNode.data.storyboardShots` |
| `ImageGenNode` | 不存在。使用 `imageNode`（ImageAssetNode 组件） |
| `VideoShotNode` | 不存在。使用 `videoNode`（VideoAssetNode 组件） |
| `nodeAnchorDispatch.ts` 的 `PARTNER_GAP` | 是锚点菜单排布常量，不是节点布局常量 |
| 调用 `dispatch(fromNodeId)` 触发下游 | dispatch 是手动操作，当前无自动下游触发机制 |

## 12. 实现步骤

1. 创建 `src/lib/hermes/types.ts`
2. 创建 `src/lib/hermes/shotNodeFactory.ts`（复用现有 `newNodeDataByType`）
3. 创建 `src/lib/hermes/autoChain.ts`（事件监听 + 节点创建）
4. 在 `src/lib/hermes/index.ts` 导出初始化函数，App 启动时调用
5. 添加单元测试（Vitest）

## 13. 待验证点

- [ ] `node-agent-event` 事件在 Tauri 环境下是否正确穿透到前端 window
- [ ] scriptNode 完成时 `storyboardShots` 是否已填充，还是需要等后续 storyboard 生成阶段
- [ ] `videoNode` 的 `video.draft.prompt` 是否会被图片生成结果自动填充（锚定机制）
