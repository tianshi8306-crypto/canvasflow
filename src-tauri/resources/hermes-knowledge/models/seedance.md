---
id: model-seedance-core
category: models
tags: [Seedance, 视频, 参数, 提示词]
---

# Seedance 视频生成（CanvasFlow 对接要点）

> 代码真源：`src/lib/seedance/`、`videoNode` draft。  
> **参数与多模态上限**见同目录 [`seedance-params.md`](./seedance-params.md)。  
> 本文供 Hermes RAG 与 `film.shot_to_video_prompt` 使用。

## 适用场景

- 单镜头图生视频、多参考 @ 语法（见 `promptBuilder.ts`）
- 短剧单镜通常 3～8 秒；超长需拆镜

## 提示词结构（推荐顺序）

1. **主体与动作**（谁、在做什么）— 人物动态详见 [`../creative/video-character-motion-prompt.md`](../creative/video-character-motion-prompt.md)（主动作+辅助动态+情绪+结束画面）
2. **环境与时间**（场景、天气、室内/室外）
3. **镜头运动**（推/拉/摇/移/固定/跟拍，择一为主）
4. **光影与色调**（侧光、霓虹、暖色、电影感等）
5. **风格锚点**（写实、动漫、古风、赛博等，与项目圣经一致）

## 运镜关键词（中文可映射为描述）

| 运镜 | 写法示例 |
|------|----------|
| 固定 | 固定机位，稳定画面 |
| 推近 | 镜头缓慢推近主体 |
| 拉远 | 镜头后拉展示环境 |
| 横摇 | 水平摇镜扫过场景 |

## 避坑（排障向）

| 现象 | 建议 |
|------|------|
| 画面抖动 | 降低运动强度描述；避免「快速」「剧烈」叠加强运动 |
| 人物畸变 | 特写时强调面部稳定；避免过多肢体同时大幅运动 |
| 画面跳变 | 单镜一条主要运动；分镜切镜用剪辑而非单条长提示 |

## 节点回填

- **字段**：`videoNode.data.video.draft.prompt`
- **可选**：参考图路径通过上游 `imageNode` 或 storyboard `imagePath` 传入 API 层
- **批量**：`film.shot_to_video_prompt` 读取 `storyboardShots[].visualPrompt` 生成 draft

## 与分镜字段关系

- `visualPrompt`：画面静态描述为主
- `video` draft：在 visualPrompt 基础上 **增加运镜 + 动态动词 + 风格词**
- 勿把台词原样塞进视频 prompt（台词走音频轨）

## 风格预设（阶段 1 规则示例）

| style | 追加词 |
|-------|--------|
| 古风 | 中国古风，胶片质感，柔和光影，服饰细节清晰 |
| 写实 | 电影级写实，自然光，浅景深 |
| 动漫 | 二次元赛璐璐，线条清晰，色块分明 |
| 赛博 | 赛博朋克，霓虹灯，雨夜反光，高对比 |
