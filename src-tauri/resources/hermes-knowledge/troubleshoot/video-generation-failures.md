---
id: troubleshoot-video-generation
category: troubleshoot
scene: troubleshoot
tags: [视频失败, 重试, Seedance, 图生视频, 排障]
---

# 视频生成失败：常见原因与修复

## 先确认工程事实

1. 该镜 **分镜图已出**（storyboardShots / 图片节点有 path）
2. 视频节点有 **draft.prompt**（缺则先 `film.shot_to_video_prompt`，人物动作用 `useMotionTemplate=true`）
3. 失败镜 `videoStatus === failed`，非仍在排队

## 常见原因

| 现象 | 可能原因 | 修复 |
|------|----------|------|
| 批量部分失败 | 提示词过长/敏感、参考图缺失 | 单镜重试；缩短 motion prompt |
| no_draft_prompt | 未写视频提示词 | shot_to_video_prompt |
| 图生视频畸变 | 多人同框 + 强运动词 | 减运动、单主体、缩短 durationSec |
| 超时 / 5xx | 服务商波动 | `video.retry_failed`，勿连点 |
| 缺关键帧仍出视频 | 断链 | 先 `image.generate_for_beats` 或单镜出图 |

## Hermes 可执行指令（示例）

- 「帮我把失败镜头的视频重新生成」→ `video.retry_failed`
- 「只重试镜 3 的失败视频」→ patch + retry 指定 beatIds
- 「检查流程断链」→ `film.workflow_check`

## 非线性画布注意

用户可能只做单镜视频，不必补齐全片关键帧；重试时 **只处理失败镜号**，勿默认批量跑完全片。
