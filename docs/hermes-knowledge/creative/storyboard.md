---
id: creative-storyboard
category: creative
tags: [分镜, visualPrompt, 景别, 运镜]
---

# 分镜文案（storyboardShots）写作规范

> **执行真源**：`scriptStoryboardGenerateAgent` system prompt；画布字段 `storyboardShots[].visualPrompt`。

## 每条分镜必须包含

1. **主体**：谁/什么在画面中心  
2. **环境**：室内/室外、时间、天气  
3. **光线与色调**：与项目圣经 `visualStyle` 一致  
4. **景别或构图**：远景/全景/中景/近景/特写（择一为主）  
5. **可选运镜暗示**：为后续视频 prompt 留一句（如「镜头缓慢推近」）

## 禁止写入 visualPrompt

- 对白、旁白全文（台词走音频轨）  
- 镜号列表、场次编号 alone  
- 抽象情绪无画面（「很悲伤」→ 改为可见动作/表情）

## 节奏建议（短剧）

- 单镜 **一个主要动作**；复杂情节拆成多镜  
- 60s 成片常见 **8～15** 镜；每镜 3～8 秒视频  
- 建立镜用远景/全景，情绪镜用近景/特写

## 与视频 prompt 分工

| 字段 | 用途 |
|------|------|
| visualPrompt | 静态画面、文生图关键帧 |
| videoMotionPrompt / draft.prompt | **动态层**：主动作、辅助动态、情绪、镜头（见 [`video-character-motion-prompt.md`](./video-character-motion-prompt.md)） |
| 初稿生成 | `film.shot_to_video_prompt`（visual + 运镜 + 风格）；再按动作模板润色 |

## 失败重试

- `status === "failed"`：Hermes「重试分镜」或重新勾选镜头生成分镜  
- 分镜 OK 但图失败：先出图再出视频
