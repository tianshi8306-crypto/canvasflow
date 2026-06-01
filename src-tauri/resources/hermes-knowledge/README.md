# Hermes 内置影视知识库

> 阶段 1 仅要求维护 `sop/` 与 `models/` 下各 1 份精简文档。  
> 格式：YAML frontmatter + Markdown 正文；按 `##` 分片索引。  
> 详见 [`../iterations/iteration-33-hermes-film-knowledge-phase1.md`](../iterations/iteration-33-hermes-film-knowledge-phase1.md)

## 目录规划

| 目录 | 阶段 | 说明 |
|------|------|------|
| `sop/` | **1** | 生产链路、画布拓扑规则 |
| `models/` | **1** | `seedance.md` 提示词；`seedance-params.md` 参数（对齐 `validation.ts`） |
| `creative/` | **1+** | 分镜/脚本/出图；`audio-tts-delivery.md`（TTS 表演）；`video-character-motion-prompt.md`（**图生视频人物动作**） |
| `practices/` | 说明 | 如何收录「官网没有」的从业者经验（见 `practices/README.md`） |
| `av-spec/` | 2 | 编码、平台、导出 |
| `troubleshoot/` | **1+** | 故障与修复 |

**非官方技巧**：来自社区实测（如分层 TTS 表演描述），与官方参数文档并列；入库前须人工审校，不爬第三方站点。

## Frontmatter 示例

```yaml
---
id: unique-doc-id
category: sop | models | av-spec | creative | troubleshoot
tags: [关键词, 英文可选]
---
```
