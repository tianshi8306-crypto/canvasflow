# iter-94 · 画布连线内联删除

## 目标

单条连线：单击选中并高亮 → 线上删除钮（首次点击处，hover 沿路径跟随，离开/过远隐藏）→ 点钮删除。

## 范围

- `edgePathGeometry.ts`、`useEdgeDeleteAffordance.ts`、`EdgeDeleteAffordance.tsx`
- `FlowCanvas.tsx`、`projectStore.deleteEdge`

## 非目标

- 多选连线内联钮
- 替代右键/Delete（仅补充）

## 验收

1. 单击连线 → 高亮 + 删除钮在点击处  
2. 沿线上移动 → 钮跟随；离开或距线 >28px → 钮消失，高亮可保留  
3. 再单击连线 → 钮再现；点钮 → 连线删除  
4. 多选边 → 无内联钮  
5. `npm run test -- edgePathGeometry`
