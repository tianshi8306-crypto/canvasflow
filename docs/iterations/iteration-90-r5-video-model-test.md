# iter-90 · R5 视频模型连通性测试

## 目标

设置 → 模型 → 视频：与图片模型一致的「测试连接」（GET `/models`）。

## 范围

- `video_cmd.rs` · `test_video_model_connection`
- `SettingsVideoModelsSection.tsx`

## 验收

1. 填写 Base URL / Key → 测试连接 → 成功/失败提示  
2. 桌面端 Tauri 可用；浏览器预览不显示按钮  
