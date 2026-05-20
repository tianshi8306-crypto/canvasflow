# 时间线导出 v1（镜头序列 JSON）

> Wave 5：在现有 `ffmpegConcat` / `render_timeline` 之上，约定「镜头序列」描述格式，为 R6 全链路导出打底。

## 目标

- 从多个 `videoNode`（含 `params.scriptBeatId`）按镜号排序收集片段路径。
- 调用 Tauri `render_timeline` 拼接为 `assets/exports/final.mp4`。

## 镜头序列 JSON（草案）

```json
{
  "version": 1,
  "clips": [
    { "beatId": "beat-1", "relPath": "assets/shot_01.mp4", "durationSec": 5 },
    { "beatId": "beat-2", "relPath": "assets/shot_02.mp4" }
  ],
  "outputRelPath": "assets/exports/final.mp4"
}
```

## 前端入口

- [`FFmpegConcatPanel.tsx`](../../src/components/nodes/FFmpegConcatPanel.tsx)：从上游 `videoNode` 收集 `path` / `assetId` 解析后的相对路径，排序后 invoke `render_timeline`。
- 与 [`timeline_cmd.rs`](../../src-tauri/src/commands/timeline_cmd.rs) 已对齐：至少 2 段 clip。

## 非目标（v1）

- 多轨音频、转场特效、WebGL 全片预览。
- 自动从 `storyboardShots` 写回时间线节点（后续迭代）。

## 验收

1. 画布上 2+ 个已出片 `videoNode` 连入 `ffmpegConcat`，导出成功。
2. 导出文件位于工程 `assets/exports/` 且可在节点预览打开。
