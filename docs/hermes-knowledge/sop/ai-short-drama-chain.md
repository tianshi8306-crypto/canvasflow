---
id: sop-short-drama-v1
category: sop
tags: [短剧, 流程, 画布, SOP]
---

# 流程：AI 短剧标准生产链路

## 阶段1 需求与大纲

- **输入**：故事主题、总时长（秒）、画面风格（写实/古风/动漫等）
- **输出**：大纲要点（人物、场景、情绪）
- **画布节点**：`textNode`（或脚本节点 `prompt` 梗概区）
- **下游依赖**：脚本节点

## 阶段2 脚本与镜头表

- **输入**：大纲、时长约束
- **输出**：`scriptBeats`（镜号、场景、画面描述、台词）
- **画布节点**：`scriptNode`
- **下游依赖**：分镜文案、媒体建链

## 阶段3 分镜文案

- **输入**：镜头表
- **输出**：每镜 `visualPrompt`（画面+运镜+光影关键词）
- **存储**：`scriptNode.storyboardShots`
- **工具**：`script.generate_storyboard` 或工作台生成
- **下游依赖**：文生图、图生视频

## 阶段4 文生图

- **输入**：分镜就绪、`visualPrompt`
- **输出**：每镜关键帧（imageNode 成片或 storyboard 图路径）
- **画布节点**：`imageNode`（`scriptBeatId` 绑定）
- **工具**：`chain.spawn_media_nodes` → `image.generate_for_beats`
- **下游依赖**：图生视频

## 阶段5 图生视频

- **输入**：分镜图 + 视频提示词（Seedance 语法）
- **输出**：每镜视频 path
- **画布节点**：`videoNode`
- **工具**：`film.shot_to_video_prompt`（填 draft）→ `video.generate_for_beats`
- **下游依赖**：剪辑合成

## 阶段6 合成与导出

- **输入**：已出片视频轨
- **输出**：时间线 / MP4
- **工具**：`compose.export_script`

## 画布拓扑规则（short_drama_v1）

| 必须 | 节点 |
|------|------|
| 是 | `textNode` → `scriptNode` |
| 推荐 | 每镜 `imageNode` + `videoNode`（脚本下游建链） |

| 连线 | 规则 |
|------|------|
| text → script | `flowConnectionPolicy` 允许 text→script |
| script → image/video | 建链或 Hermes `chain.spawn_media_nodes` |

## Hermes 一键搭建

- 用户意图：「做短剧」「搭建拍摄流程」「30秒 N 镜」
- 工具：`film.create_standard_workflow`
- 参数：`brief`、`style`、`shotCount`、`totalDurationSec`
