# Milestone M2：端口类型与非法连线不可持久化

**目标**（见 [`development-plan.md`](./development-plan.md) 阶段 B）：**B.1** 粗粒度端口类型；**B.2** 边上携带 `data.payloadType`；**非法连线无法在画布持久化**。

## 实现摘要

| 项 | 说明 |
|----|------|
| `src/lib/flowConnectionPolicy.ts` | `PortType`（text / image / video / audio / script）；`getOutputPortType`、`isConnectionAllowed`、`connectionRejectedReason`；`sanitizeCanvasEdges` 读盘/合并时剔除非法边并补全 `payloadType` |
| `src/lib/flowEdge.ts` | `makeFlowEdge(source, target, sourceNodeType?)` 写入 `data.payloadType` |
| `src/lib/serialization.ts` | `parseCanvas` 返回 `invalidEdgesDropped`，打开工程时移除不兼容边 |
| `projectStore` | `onConnect` 拒绝非法边并提示；`spawnAnchoredPartner` / `pasteSelection` / `addNodesWithEdges` / `loadGraph` 与 sanitize 对齐 |
| `FlowCanvas.tsx` | `isValidConnection` 拖拽时即禁止非法连接 |

## 验收建议

1. 尝试将 **图片节点输出** 连到 **纯文本节点输入** → 应无法连上，状态栏说明类型不匹配。
2. 保存含非法边的旧 `canvasflow.json` → 打开后非法边被移除，状态栏提示移除条数。
3. 合法边（如 文本→视频、图片→视频、视频→合成）仍可保存与重开。

## 后续（非 M2 必做）

- Handle 显式 `id` 与端口一一对应、多输入口细分类型。
- 执行器 `resolve_inputs` 与端口类型对齐（阶段 B.3 / C）。
