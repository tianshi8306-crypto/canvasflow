# 迭代 18 — P3 时间线合成与导出闭环

> 层：**ProductionFlowLayer**（R6 打底）  
> 更新：**2026-05-21**  
> 状态：**已冻结**（单人开发：复用既有 ComposeEditor，只补闭环缺口）

## 0) 决策

仓库里**已有**全屏 `ComposeEditorOverlay`、时间线裁剪/分割、`exportScriptCompose`（脚本分镜导出）。  
本迭代**不重做**时间线 UI，只补：

1. 剪辑台「从脚本镜头填充」
2. Inspector / 节点底栏引导进剪辑台
3. 导出后 `path` + `assetId` 双写（`patchComposeNodeAfterExport`）

## 1) 功能清单

| 项 | 说明 |
|----|------|
| P3-1 | `findScriptNodeForCompose` + `handleRefreshFromScript` |
| P3-2 | 时间线工具栏菜单「从脚本镜头填充」 |
| P3-3 | Inspector 合成节点：打开剪辑工作台（去掉手填路径 textarea） |
| P3-4 | 底栏 `FFmpegConcatPanel`「时间线编辑」钮；导出写 assetId |

## 2) 非目标

- 多轨音频、转场、WebGL 全片预览
- 替换 `render_timeline` / FFmpeg 后端
- Inspector 重新挂到 App 壳（仍按 iteration-15 说明）

## 3) 验收

1. 脚本→视频→合成连线后，剪辑台「更多 → 从脚本镜头填充」填入镜序片段。
2. 合成节点单击/双击打开全屏剪辑；底栏可点「时间线编辑」。
3. 时间线导出后节点可预览成片，且 `runs.db` 有对应 asset（若文件在 assets 下）。
4. 脚本分镜「导出成片」行为与改前一致，仍打开剪辑台。

## 4) 入口索引

| 入口 | 路径 |
|------|------|
| 全屏剪辑 | `ComposeEditorOverlay.tsx`、`useComposeNodeEditor.ts` |
| 脚本一键导出 | `projectStore.exportScriptCompose`、`ScriptStoryboardSection` |
| 从脚本填充 | `findScriptForCompose.ts` |
