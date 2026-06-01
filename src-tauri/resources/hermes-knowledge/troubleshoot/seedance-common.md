---
id: troubleshoot-seedance-core
category: troubleshoot
tags: [Seedance, 排障, 视频, 抖动]
---

# Seedance 常见问题与修复

## 画面抖动

- **现象**：主体边缘闪烁、背景漂移
- **原因**：提示词叠加强运动词（快速、剧烈、爆炸式）
- **修复**：改为「镜头运动平稳」；单镜一条主要运动；降低 durationSec

## 人物畸变

- **现象**：面部变形、肢体数量异常
- **修复**：特写时强调「面部稳定」；避免多人同时大幅动作；优先图生视频并绑定参考图

## 缺少 draft.prompt 无法批量出视频

- **现象**：Hermes 提示 no_draft_prompt
- **修复**：执行 `film.shot_to_video_prompt` 或手动填写 videoNode draft

## 断链：有分镜无 videoNode

- **现象**：workflow_check 媒体建链待办
- **修复**：`chain.spawn_media_nodes` 后再写视频提示词

## 批量视频失败重试

- **现象**：`videoStatus === failed`
- **修复**：Hermes「重试失败视频」→ `video.retry_failed`；或工作台「重试失败视频」
- **注意**：需仍有分镜图与 `draft.prompt`；缺则先 `film.shot_to_video_prompt`
