# 迭代 14-4C：批量视频 + 合成导出稳态

**层**：ProductionFlowLayer + AssetAndQualityLayer  
**核心目标**：分镜区「批量生成视频」「导出成片」按勾选范围预检、状态栏进度与明确失败/跳过原因，可重复验收。

## 功能点

1. **批量视频预检**（`assessBatchVideoReadiness`）：勾选范围、分镜图、视频节点、视频草稿 prompt  
2. **合成导出预检**（`assessComposeExportScope`）：范围内可纳入镜数与缺失明细  
3. **分镜区说明条**：可提交数 / 可导出数 + 跳过原因摘要  
4. **批量视频进度**：`onProgress` + 顶栏 `批量视频 n/total`  
5. **重试失败视频**：范围内 `videoStatus=failed` 的镜头  
6. **导出按范围**：`exportScriptCompose({ beatIds })` → `buildComposeClipsFromScript` 过滤镜号

## 模块

| 模块 | 文件 |
|------|------|
| 预检 | `src/lib/storyboard/scriptProductionExport.ts` |
| 批量视频 | `src/lib/storyboard/batchGenerateVideos.ts` |
| 合成 | `src/lib/compose/buildFromScript.ts`、`projectStore.exportScriptCompose` |
| UI | `src/components/ScriptStoryboardSection.tsx` |

## 非目标

- 重做分镜 Agent / Hermes 策略  
- 全局时间轴对齐（E1）  
- 无人值守跑完全片

## 手动验收

1. 工作台勾选 3/10 镜 → 分镜区说明条显示「勾选 3」→「批量生成视频」仅提交范围内可提交镜头  
2. 批量进行中顶栏显示 `批量视频 2/3…`  
3. 部分镜无视频节点 → 按钮禁用或点击后状态栏提示建链  
4. 3 镜中 2 镜已出片 →「导出成片（2/3）」→ 导出 mp4 或状态栏明确 FFmpeg/缺失原因  
5. 某镜 `videoStatus=failed` →「重试失败视频（1）」仅重试该镜

## 回滚

- 移除 `scriptProductionExport.ts` 与分镜区说明条/重试按钮  
- `exportScriptCompose` 恢复不传 `beatIds`；`ScriptStoryboardSection` 恢复全量 `assessScriptComposeReadiness`
