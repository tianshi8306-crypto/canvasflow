# Iteration 59 — 导出分辨率 / 码率面板

> 真源：[compose-editor-basic-features.md](../product/compose-editor-basic-features.md) #21 · iter-58 G5 延伸

## 1) 目标

剪辑台与合成节点可配置导出**分辨率预设**与**视频码率**，写入节点 `exportEncode` 并由 FFmpeg 重编码生效。

## 2) 范围

- `timelineExportEncode.ts` + `compose_concat.rs` `TimelineEncodeOptions`
- `ComposeEditorExportSettings` + 剪辑台齿轮面板
- `render_timeline` / `useComposeNodeEditor` / `exportScriptCompose`

## 3) 功能

1. **分辨率**：源尺寸 / 1080p / 720p / 480p（scale+pad，保持比例）
2. **码率**：自动 (CRF) / 2–12 Mbps 预设
3. 设置持久化在 `ffmpegConcat.exportEncode`，随工程保存
4. 非默认编码时禁用 stream copy，强制重编码

## 4) 非目标

- 自定义宽高数值输入、帧率、音频码率独立面板
- Hermes 自然语言解析分辨率（可后续）

## 5) 验收

1. 剪辑台 ⚙ → 选 720p + 4 Mbps → 导出 → 成片约 720p
2. 重开工程后设置仍在合成节点
3. `npm run test -- timelineExportEncode` 与 `cargo test compose_concat` 通过

## 6) 状态

✅ 已实现（iter-59）
