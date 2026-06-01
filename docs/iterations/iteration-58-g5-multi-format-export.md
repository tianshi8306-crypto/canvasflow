# Iteration 58 — G5 多格式导出

> 真源：[HERMES_CURSOR_AGENT_SPEC.md](../product/HERMES_CURSOR_AGENT_SPEC.md) §3.2 G5 · [compose-editor-basic-features.md](../product/compose-editor-basic-features.md) #21

## 1) 目标

时间线 / 脚本合成导出除默认 MP4 外，支持 **MOV、WebM** 可选；Hermes「导出 webm」类话术自动带入格式。

## 2) 范围（3 模块）

- `timelineExportFormat.ts` + `compose_concat.rs` — 格式解析与 FFmpeg 编码
- 剪辑台 `ComposeEditorExportMenu`、合成节点 `FFmpegConcatPanel`
- `exportScriptCompose` / `compose.export_script` / `buildDirectorPlan`

## 3) 功能

1. **MP4 / MOV / WebM**：由输出路径扩展名决定编码（H.264+AAC / MOV 容器 / VP9+Opus）
2. 剪辑台顶栏：导出按钮 + 格式下拉，切换时同步 `output` 路径扩展名
3. Hermes：用户消息含 `webm`/`mov`/`mp4` → 计划步 `exportFormat` → `assets/exports/final.{ext}`
4. 单段同扩展名仍 stream copy；跨格式自动重编码

## 4) 非目标

- 分辨率 / 码率 / 帧率面板（→ iter-59）
- ProRes、GIF（→ iter-60）

## 5) 验收

1. 剪辑台选 WebM → 导出 → 工程内 `assets/exports/final.webm` 可播放
2. 合成节点面板格式下拉与输出路径扩展名一致
3. Hermes：「导出 webm 成片」→ 计划含 `exportFormat: webm`
4. `npm run test -- timelineExportFormat hermesDirector` 通过

## 6) UI/UX

- **剪辑台顶栏**：`导出 MP4` + 右侧格式 `<select>`
- **合成节点面板**：输出路径行末格式下拉

## 7) 状态

✅ 已实现（iter-58 / G5）
