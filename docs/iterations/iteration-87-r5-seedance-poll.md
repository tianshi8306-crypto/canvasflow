# iter-87 · R5 Seedance 轮询解析加固

## 目标

`poll_video_job_http` 兼容多版 JSON 字段；仅 `mock_` job 走 ffmpeg 降级。

## 范围

- `video_cmd.rs`（`map_seedance_task_status`、`parse_video_url_from_task_json`）

## 验收

1. 配置 Seedance Key 后提交任务 → 成功落盘 `assets/`  
2. `cargo test poll_parse` 通过  
