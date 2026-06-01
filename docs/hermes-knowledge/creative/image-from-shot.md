---
id: creative-image-from-shot
category: creative
tags: [文生图, 关键帧, visualPrompt, 角色一致]
---

# 分镜 → 文生图（关键帧）提示词

> **执行**：`imageGenerationAgent` + `buildImagePromptWithStyles`；批量：`image.generate_for_beats`。

## 结构（推荐）

1. 主体 + 动作/姿态  
2. 场景与环境  
3. 光线、镜头（浅景深/广角）  
4. 风格词（写实/古风/赛博，与圣经一致）  
5. negativePrompt（可选）：低质量、多余手指、文字水印

## 角色一致性

- 镜头表「角色图」列 + **项目圣经**默认参考图 → 自动图生图 reference  
- Hermes 会话 **@素材** → 本轮批量出图额外参考  
- 同一角色跨镜：圣经中固定 `referenceRelPath`

## 与分镜字段

- 优先用 `storyboardShots[].visualPrompt`（已含景别光影）  
- 若仅有 `scriptBeats[].description`：先跑分镜生成再出图

## 常见跳过原因（批量出图）

- 分镜未 `generated` 或无 visualPrompt  
- 未建 imageNode → 先 `chain.spawn_media_nodes`  
- 工程未打开 / 未配置图生模型

## 排障

- 风格漂移：检查圣经 `visualStyle` 与每条 visualPrompt 是否矛盾  
- 人物不像：补角色参考图或缩小景别到近景
