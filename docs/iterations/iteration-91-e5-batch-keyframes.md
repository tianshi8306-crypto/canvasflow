# iter-91 · E5 批量出关键帧（首切片）

## 目标

分镜区一键「批量出关键帧」：预检 + 缺图片节点时自动建链 + 云端批量出图（对齐 E5 Epic 首条可验收路径）。

## 范围

- `scriptProductionExport.ts` · `assessBatchImageReadiness`
- `ScriptStoryboardSection.tsx`

## 非目标

- 无工程内图片节点时从零建脚本（仍须先有分镜文案）
- E5 全量（跨 Tab 调度、云端队列 UI）

## 验收

1. 勾选 2 镜有分镜文案、无图片节点 → 点「批量出关键帧」→ 建链并排队出图  
2. 已有图片节点缺图 → 仅批量提交、不重复建链  
3. `npm run test -- scriptProductionExport`
