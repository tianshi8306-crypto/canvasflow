# 迭代 12-3A：创意视图 ↔ 分镜资产

**层**：CanvasExperienceLayer + ProductionFlowLayer  
**核心目标**：全屏「创意视图」成为分镜图/文案的主浏览面，与脚本表勾选、Inspector 分镜区一致。

## 功能点

1. 创意网格 checkbox 与 `scriptBeatSelection` 联动（工具栏显示已选 N/M、全选/清空）
2. 缩略区「本机选图 / 换图」写入 `storyboardShots[].imagePath`（共享 `scriptStoryboardImageImport`）
3. 「分镜区」关闭全屏 → 选中节点 → Inspector 展开对应镜头详情

## 模块

| 模块 | 文件 |
|------|------|
| 分镜图导入 | `src/lib/scriptStoryboardImageImport.ts` |
| 创意网格 | `ScriptCreativeViewGrid.tsx` |
| 全屏 | `ScriptNodeFullscreenOverlay.tsx` |
| Inspector 聚焦 | `canvasUiStore.inspectorStoryboardFocus`、`ScriptStoryboardSection` |
| 入口 | `openInspectorStoryboardBeat` in `scriptNodeCanvasEntries.ts` |

## 非目标

- 云端批量文生图（R4）
- 卡片视图角色编辑（3-B）

## 手动验收

1. 全屏脚本表勾选 2 镜 → 切创意视图 → 同 2 镜为选中态  
2. 创意视图勾选/取消 → 回脚本表勾选一致  
3. 无图卡片点「本机选图」→ 缩略图出现且 `assets` 有文件  
4. 点「分镜区」→ 全屏关闭、Inspector 分镜详情展开该镜  
5. 顶栏「生成分镜」仍按勾选范围（与 09-0A 一致）

## 回滚

- 移除创意视图勾选/选图/分镜区按钮；恢复 `ScriptCreativeViewGrid` 只读展示
