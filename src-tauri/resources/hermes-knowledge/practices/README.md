---
id: practices-readme
category: creative
tags: [社区实践, 经验, 非官方]
---

# 从业者技巧（非官方知识层）

## 定位

- **官方 / 代码真源**：`models/seedance-params.md`（对齐 `validation.ts`）、即梦手册 PDF 人工摘要  
- **本层**：社区、课程、博主（如行业站点分享的 TTS/分镜技巧）经 **人工提炼** 的可执行写法  
- **禁止**：整站爬取、未审校的提示词大全、PDF OCR 批量入库

## 当前收录

| 文档 | 说明 |
|------|------|
| [`../creative/audio-tts-delivery.md`](../creative/audio-tts-delivery.md) | 台词四层表演模板（TTS 文本框） |

## 如何新增一条「网上看到的好技巧」

1. 用 **自己的话** 写成 ≤80 行 Markdown，`category: creative` 或 `troubleshoot`  
2. frontmatter 加 `tags`（中英文关键词都要有，便于 FTS）  
3. 写清 **反例 / 正例 / 适用模型 / 画布字段**  
4. 放入 `docs/hermes-knowledge/creative/` 或 `troubleshoot/`  
5. 桌面端 **重建 Hermes 知识索引**

## 与 Hermes 的关系

检索场景 `creative` / `troubleshoot`；聊天里问「怎么写配音」「TTS 悲伤」时会自动带入片段。  
执行仍由用户粘贴到 `audioNode` 或后续专用 Tool，不由 RAG 直接调 API。
