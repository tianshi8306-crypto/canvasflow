# Iteration 60 — ProRes / GIF 导出

> 延伸 iter-58 G5 多格式

## 1) 目标

剪辑台与合成节点新增 **ProRes 422 (MOV)** 与 **GIF** 导出；ProRes 与 H.264 MOV 共用 `.mov` 扩展名，靠节点字段 `exportFormat` 区分。

## 2) 功能

1. 格式下拉：ProRes 422 (MOV)、GIF
2. `exportFormat` 持久化；`render_timeline` 显式传 `exportFormat`
3. FFmpeg：`prores_ks` yuv422p10le；GIF 12fps + palettegen/use，无音轨
4. GIF 导出时隐藏码率预设，显示固定说明
5. Hermes：话术含 prores / gif 时写入 `exportFormat`

## 3) 非目标

- ProRes 4444 / LT、GIF 自定义 fps、透明 GIF

## 4) 验收

1. 选 ProRes → 导出 `.mov` 可在剪辑软件识别（需 FFmpeg 含 prores_ks）
2. 选 GIF → 得到可播放 `.gif`，约 12fps
3. ProRes 与 MOV(H.264) 切换后 `exportFormat` 不同、路径均为 `.mov`
4. 单测通过

## 5) 状态

✅ 已实现（iter-60）
