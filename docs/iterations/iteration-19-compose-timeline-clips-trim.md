# 迭代 19 — 时间线数据模型 + 裁切导出

**层**：CanvasExperienceLayer  
**目标**：`timelineClips` 持久化入出点；`render_timeline` 导出前按 in/out 裁切再拼接。

## 功能

- `ComposeTimelineClip`：`id`, `relPath`, `inSec`, `outSec`, `sourceNodeId?`
- 读取时兼容 legacy `inputs: string[]`，打开工作台时自动迁移
- Tauri `render_timeline` 接受 `{ relPath, inSec, outSec }[]`，裁切写入 `.canvasflow/timeline-trim/`

## 模块

- `src/lib/compose/timelineClips.ts`
- `src-tauri/src/timeline_trim.rs` + `commands/timeline_cmd.rs`
- `src/hooks/useComposeNodeEditor.ts`

## 验收

1. 旧工程仅有 `inputs` 时，进入剪辑工作台后保存为 `timelineClips`
2. 手动设置片段 `inSec/outSec`（后续 UI 迭代 20 提供按钮）后导出，成片时长反映裁切
3. `npm run test` 中 `timelineClips.test.ts` / `timelineLayout.test.ts` 通过
4. `cargo test` compose_concat / timeline_trim 通过

## Out of scope

- 播放头分割、撤销栈、修剪按钮 UI（迭代 20）
- 胶片多帧缩略图抛光（迭代 21）

## 回退

Revert 迭代 19；`render_timeline` 恢复仅 `Vec<String>`（需同步回退前端 invoke）。
